import type { SampleConversation } from "../types";

export const agenticCoding: SampleConversation = {
  id: "agentic-coding",
  title: "Fix Failing Test",
  description: "An agentic coding loop: reading files, editing code, running tests",
  category: "agentic",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "The test in `auth.test.ts` is failing with `TypeError: Cannot read properties of undefined (reading 'token')`. Can you investigate and fix it?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content:
            "Let me look at the failing test to understand what's going on.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/__tests__/auth.test.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import { describe, it, expect } from 'vitest';
import { authenticateUser } from '../auth';

describe('authenticateUser', () => {
  it('should return a valid token for correct credentials', async () => {
    const result = await authenticateUser('admin', 'password123');
    expect(result.token).toBeDefined();
    expect(result.token).toMatch(/^eyJ/);
  });

  it('should throw for invalid credentials', async () => {
    await expect(
      authenticateUser('admin', 'wrong')
    ).rejects.toThrow('Invalid credentials');
  });

  it('should include user role in response', async () => {
    const result = await authenticateUser('admin', 'password123');
    expect(result.user.role).toBe('admin');
  });
});`,
        },
        {
          type: "text",
          content:
            "The test accesses `result.token` and `result.user.role`. Let me check the auth module to see what it actually returns.",
        },
        {
          type: "tool_call",
          toolName: "read_file",
          args: JSON.stringify({ path: "src/auth.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "read_file",
          output: `import jwt from 'jsonwebtoken';
import { db } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: { id: string; role: string };
  };
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<AuthResponse> {
  const user = await db.users.findByUsername(username);

  if (!user || user.password !== password) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return {
    success: true,
    data: {
      token,
      user: { id: user.id, role: user.role },
    },
  };
}`,
        },
        {
          type: "text",
          content: `Found the issue. The \`authenticateUser\` function returns \`{ success, data: { token, user } }\`, but the test accesses \`result.token\` directly instead of \`result.data.token\`.

The response was recently refactored to wrap the payload inside a \`data\` field, but the tests weren't updated. The fix is to update the test to use \`result.data.token\` and \`result.data.user.role\`.`,
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/__tests__/auth.test.ts",
              old_string:
                "    const result = await authenticateUser('admin', 'password123');\n    expect(result.token).toBeDefined();\n    expect(result.token).toMatch(/^eyJ/);",
              new_string:
                "    const result = await authenticateUser('admin', 'password123');\n    expect(result.data?.token).toBeDefined();\n    expect(result.data?.token).toMatch(/^eyJ/);",
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully edited src/__tests__/auth.test.ts",
        },
        {
          type: "tool_call",
          toolName: "edit_file",
          args: JSON.stringify(
            {
              path: "src/__tests__/auth.test.ts",
              old_string:
                "    const result = await authenticateUser('admin', 'password123');\n    expect(result.user.role).toBe('admin');",
              new_string:
                "    const result = await authenticateUser('admin', 'password123');\n    expect(result.data?.user.role).toBe('admin');",
            },
            null,
            2,
          ),
        },
        {
          type: "tool_result",
          toolName: "edit_file",
          output: "Successfully edited src/__tests__/auth.test.ts",
        },
        {
          type: "text",
          content: "Now let me run the tests to confirm the fix.",
        },
        {
          type: "tool_call",
          toolName: "run_tests",
          args: JSON.stringify({ path: "src/__tests__/auth.test.ts" }, null, 2),
        },
        {
          type: "tool_result",
          toolName: "run_tests",
          output: ` ✓ src/__tests__/auth.test.ts (3 tests)
   ✓ authenticateUser > should return a valid token for correct credentials (12ms)
   ✓ authenticateUser > should throw for invalid credentials (3ms)
   ✓ authenticateUser > should include user role in response (8ms)

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  14:32:07
   Duration  1.24s`,
        },
        {
          type: "text",
          content: `All 3 tests pass now. The issue was that the \`AuthResponse\` type was refactored to nest the token and user data inside a \`data\` field, but the tests were still accessing them at the top level. I updated both test assertions to use \`result.data?.token\` and \`result.data?.user.role\` with optional chaining for safety.`,
        },
      ],
    },
  ],
};
