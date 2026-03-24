import type { SampleConversation } from "../types";

export const refactorApi: SampleConversation = {
  id: "refactor-api",
  title: "Refactor REST Endpoint",
  description: "Restructuring a messy API endpoint with validation, error handling, and tests",
  category: "agentic",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "The POST /api/users endpoint is a mess — no validation, inconsistent errors, and no tests. Can you clean it up?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: "Let me start by reading the current endpoint to understand what we're working with.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/routes/users.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import { Router } from 'express';
import { db } from '../database';
import bcrypt from 'bcrypt';

const router = Router();

router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, name, role, created_at',
      [email, hash, name, role || 'user']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;`,
        },
        {
          type: "text",
          content: `I see several issues:

1. **No input validation** — email format, password strength, name length, role values are unchecked
2. **SQL injection risk** — while parameterized queries help, there's no sanitization layer
3. **Inconsistent error responses** — some return \`{ error }\`, the 500 gives no useful info
4. **No request typing** — everything is \`any\`
5. **Password hash rounds hardcoded** — should be configurable
6. **No tests at all**

Let me also check if there's an existing validation setup or error handling middleware.`,
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/middleware/error-handler.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}`,
        },
        {
          type: "text",
          content: "Good — there's already an `AppError` class and error handler middleware. The users route isn't using it. Let me check if there's a validation library installed.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "package.json" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `{
  "name": "api-server",
  "dependencies": {
    "express": "^4.18.2",
    "bcrypt": "^5.1.1",
    "pg": "^8.11.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.2.0",
    "@types/express": "^4.17.21",
    "@types/bcrypt": "^5.0.2"
  }
}`,
        },
        {
          type: "text",
          content: "Zod is installed — I'll use that for validation. And vitest for tests. Now let me write the refactored endpoint.",
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/routes/users.ts",
              create: true,
              content: `import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../database';
import { AppError } from '../middleware/error-handler';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const VALID_ROLES = ['user', 'admin', 'editor'] as const;

const createUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or fewer')
    .transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer')
    .trim(),
  role: z.enum(VALID_ROLES).optional().default('user'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

const router = Router();

router.post(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          422,
          parsed.error.issues.map((i) => i.message).join('; '),
          'VALIDATION_ERROR'
        );
      }
      const { email, password, name, role }: CreateUserInput = parsed.data;

      // Check for existing user
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) {
        throw new AppError(409, 'A user with this email already exists', 'USER_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert user
      const result = await db.query(
        \`INSERT INTO users (email, password_hash, name, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, email, name, role, created_at\`,
        [email, passwordHash, name, role]
      );

      const user = result.rows[0];
      res.status(201).json({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;`,
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully wrote src/routes/users.ts",
        },
        {
          type: "text",
          content: "Now let me write comprehensive tests for this endpoint.",
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/routes/__tests__/users.test.ts",
              create: true,
              content: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import usersRouter from '../users';
import { errorHandler } from '../../middleware/error-handler';
import { db } from '../../database';

vi.mock('../../database');
vi.mock('bcrypt');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', usersRouter);
  app.use(errorHandler);
  return app;
}

describe('POST /api/users', () => {
  const validUser = {
    email: 'test@example.com',
    password: 'SecurePass1',
    name: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never);
    vi.mocked(db.query).mockResolvedValue({ rows: [] } as never);
  });

  describe('validation', () => {
    it('rejects missing email', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, email: undefined });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid email format', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('rejects short passwords', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, password: 'Ab1' });
      expect(res.status).toBe(422);
    });

    it('rejects passwords without uppercase', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, password: 'alllowercase1' });
      expect(res.status).toBe(422);
    });

    it('rejects passwords without numbers', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, password: 'NoNumbersHere' });
      expect(res.status).toBe(422);
    });

    it('rejects invalid roles', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, role: 'superadmin' });
      expect(res.status).toBe(422);
    });

    it('accepts valid roles', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: '1', email: 'test@example.com',
            name: 'Test User', role: 'editor', created_at: new Date()
          }]
        } as never);

      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send({ ...validUser, role: 'editor' });
      expect(res.status).toBe(201);
    });
  });

  describe('duplicate handling', () => {
    it('returns 409 for existing email', async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: 'existing-id' }]
      } as never);

      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send(validUser);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('successful creation', () => {
    it('creates user and returns 201', async () => {
      const createdUser = {
        id: 'new-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        created_at: '2024-01-15T10:30:00Z',
      };
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [createdUser] } as never);

      const app = createApp();
      const res = await request(app)
        .post('/api/users')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('new-id');
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('password_hash');
    });

    it('normalizes email to lowercase', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: '1', email: 'test@example.com',
            name: 'Test', role: 'user', created_at: new Date()
          }]
        } as never);

      const app = createApp();
      await request(app)
        .post('/api/users')
        .send({ ...validUser, email: 'TEST@Example.COM' });

      const insertCall = vi.mocked(db.query).mock.calls[1];
      expect(insertCall[1][0]).toBe('test@example.com');
    });

    it('defaults role to user', async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({
          rows: [{
            id: '1', email: 'test@example.com',
            name: 'Test', role: 'user', created_at: new Date()
          }]
        } as never);

      const app = createApp();
      await request(app)
        .post('/api/users')
        .send(validUser);

      const insertCall = vi.mocked(db.query).mock.calls[1];
      expect(insertCall[1][3]).toBe('user');
    });
  });
});`,
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully wrote src/routes/__tests__/users.test.ts",
        },
        {
          type: "text",
          content: "Let me run the tests to verify everything works.",
        },
        {
          type: "tool_call",
          toolName: "run_tests",
          args: JSON.stringify(
            { path: "src/routes/__tests__/users.test.ts" },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "run_tests",
          output: ` ✓ src/routes/__tests__/users.test.ts (10 tests)
   ✓ POST /api/users > validation > rejects missing email (15ms)
   ✓ POST /api/users > validation > rejects invalid email format (5ms)
   ✓ POST /api/users > validation > rejects short passwords (4ms)
   ✓ POST /api/users > validation > rejects passwords without uppercase (3ms)
   ✓ POST /api/users > validation > rejects passwords without numbers (3ms)
   ✓ POST /api/users > validation > rejects invalid roles (4ms)
   ✓ POST /api/users > validation > accepts valid roles (8ms)
   ✓ POST /api/users > duplicate handling > returns 409 for existing email (6ms)
   ✓ POST /api/users > successful creation > creates user and returns 201 (7ms)
   ✓ POST /api/users > successful creation > normalizes email to lowercase (5ms)
   ✓ POST /api/users > successful creation > defaults role to user (4ms)

 Test Files  1 passed (1)
      Tests  10 passed (10) 1 skipped
   Start at  09:15:22
   Duration  2.31s`,
        },
        {
          type: "text",
          content: `All 10 tests pass. Here's a summary of the refactoring:

**Input validation** — Added Zod schema with email format validation, password strength requirements (min 8 chars, uppercase, number), name length limits, and role enum validation. Invalid requests get a 422 with specific error messages.

**Error handling** — Switched from ad-hoc \`res.status().json()\` to the existing \`AppError\` class and \`next(err)\` pattern, so all errors flow through the centralized error handler. Added specific error codes (\`VALIDATION_ERROR\`, \`USER_EXISTS\`, \`INTERNAL_ERROR\`) for programmatic error handling by API consumers.

**Response format** — Wrapped the response in a \`{ data: ... }\` envelope for consistency, renamed \`created_at\` to \`createdAt\` in the response, and ensured password-related fields are never exposed.

**Security** — Bcrypt rounds configurable via \`BCRYPT_ROUNDS\` env var (defaulting to 12 instead of 10), email normalized to lowercase to prevent duplicate accounts with case variations.

**Tests** — 10 tests covering validation edge cases, duplicate detection, successful creation, email normalization, and role defaults.`,
        },
      ],
    },
  ],
};
