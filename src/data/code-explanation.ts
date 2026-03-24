import type { SampleConversation } from "../types";

export const codeExplanation: SampleConversation = {
  id: "code-explanation",
  title: "React Hook Explained",
  description: "Breaking down a custom React hook for debounced search",
  category: "code",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content: `Can you explain what this hook does and how I could improve it?

\`\`\`typescript
function useDebounceSearch(query: string, delay: number = 300) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(\`/api/search?q=\${query}\`);
      const data = await res.json();
      setResults(data);
      setLoading(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return { results, loading };
}
\`\`\``,
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `This is a **debounced search hook** — it waits for the user to stop typing before making an API call. Let me break it down:

**How it works:**

1. Every time \`query\` changes, the \`useEffect\` fires
2. It sets a timeout for \`delay\` ms (default 300ms)
3. If \`query\` changes again before the timeout fires, the cleanup function (\`clearTimeout\`) cancels the pending request
4. Only when the user stops typing for 300ms does the fetch actually execute

**The Good:**
- Prevents flooding the API with requests on every keystroke
- Clears results when query is empty
- Returns a loading state for the UI

**Issues to fix:**

1. **Race condition** — if the user types "cat", waits, then types "car", both fetches fire. If the "cat" response arrives *after* "car", you'll show wrong results.

2. **No error handling** — a failed fetch will leave \`loading: true\` forever.

3. **URL injection** — interpolating \`query\` directly into the URL without encoding is unsafe.

4. **The async function inside setTimeout** — the cleanup won't abort an in-flight request, only prevent new ones from starting.

Here's an improved version:

\`\`\`typescript
function useDebouncedSearch<T>(query: string, delay: number = 300) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        const res = await fetch(\`/api/search?\${params}\`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(\`Search failed: \${res.status}\`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, delay]);

  return { results, loading, error };
}
\`\`\`

**Key improvements:**
- **AbortController** cancels in-flight requests on cleanup, fixing the race condition
- **URLSearchParams** properly encodes the query
- **Error handling** with try/catch, ignoring AbortError
- **Generic type** \`T\` for type-safe results
- **Trims whitespace** before checking empty query`,
        },
      ],
    },
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "How would I test this hook? Especially the debounce timing and race condition handling?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `Testing custom hooks with async behavior and timers requires a few specific techniques. Here's how I'd approach it using \`vitest\` and \`@testing-library/react\`:

\`\`\`typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDebouncedSearch } from './use-debounced-search';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedSearch', () => {
  it('does not fetch immediately on query change', () => {
    renderHook(() => useDebouncedSearch('hello'));

    // No fetch should have been called yet
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches after the debounce delay', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'Result' }]),
    });

    const { result } = renderHook(() => useDebouncedSearch('hello', 300));

    // Advance past the debounce delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/search?q=hello',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    // Wait for the async state update
    await waitFor(() => {
      expect(result.current.results).toEqual([{ id: 1, name: 'Result' }]);
      expect(result.current.loading).toBe(false);
    });
  });

  it('cancels previous request when query changes rapidly', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

    const { rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query, 300),
      { initialProps: { query: 'he' } }
    );

    // Type more before debounce fires
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ query: 'hel' });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ query: 'hello' });

    // The previous timeouts should have been cleared
    // Only the last query should trigger a fetch
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/search?q=hello',
      expect.any(Object)
    );

    abortSpy.mockRestore();
  });

  it('handles race conditions via AbortController', async () => {
    // First request will be slow
    let resolveFirst: (value: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    // Second request will be fast
    mockFetch
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 2, name: 'Second' }]),
      });

    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query, 300),
      { initialProps: { query: 'cat' } }
    );

    // First query fires
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Change query — this should abort the first request
    rerender({ query: 'car' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Resolve the first (aborted) request — it should be ignored
    resolveFirst!({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'First' }]),
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([{ id: 2, name: 'Second' }]);
    });
  });

  it('clears results for empty query', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedSearch(query, 300),
      { initialProps: { query: 'hello' } }
    );

    rerender({ query: '' });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('sets error state on failed fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useDebouncedSearch('hello', 300));

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('500');
      expect(result.current.results).toEqual([]);
    });
  });
});
\`\`\`

**Key testing techniques used:**

1. **\`vi.useFakeTimers()\`** — lets you control time. Without this, you'd need to actually wait 300ms for each test, making the suite slow.

2. **\`vi.advanceTimersByTime(300)\`** — fast-forwards the debounce delay so the \`setTimeout\` fires synchronously.

3. **\`renderHook\`** — from Testing Library, lets you test hooks outside of a component. The \`rerender\` function simulates prop changes (like the user typing).

4. **\`waitFor\`** — handles the async state updates. After \`fetch\` resolves, React needs to re-render. \`waitFor\` polls until the assertion passes.

5. **Race condition test** — the trickiest one. We mock two sequential fetches, trigger both, then verify only the second result is used. The \`AbortController\` ensures the first request is cancelled, so even if it resolves, the \`AbortError\` catch block ignores it.

6. **\`act()\`** wrapping — required when triggering state updates in hooks. Timer advances and rerenders that cause state changes need to be wrapped in \`act()\` to flush React's update queue.`,
        },
      ],
    },
  ],
};
