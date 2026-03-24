# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc -b && vite build → dist/
npm run preview      # Serve production build locally
npm run generate-og  # Regenerate OG image (public/og-image.png)
```

No test suite exists. Verify changes by running `npx tsc -b` for type-checking and `npm run build` for a full build.

## Architecture

This is a client-side React app that simulates LLM token streaming at configurable speeds. The core data flow:

**Conversation Data** → **Tokenization** (gpt-tokenizer, GPT-4o/o200k_base encoding) → **PlaybackEngine** (timed token emission) → **React Components** (streaming UI)

### Engine (`src/engine/`)

`PlaybackEngine` is the core class. It runs a ~60fps tick loop that emits tokens based on wall-clock time:

```
expectedTokens = segmentStartTokens + floor(streamingElapsed × tokensPerSecond)
tokensToEmit = expectedTokens - totalTokensEmitted
```

Key behaviors:
- User messages render instantly; assistant messages stream token-by-token
- Tool call segments stream their args, then pause 800ms (simulated execution), then tool result appears instantly
- `streamingElapsedMs` tracks only active streaming time (excludes tool delays) for accurate effective tok/s calculation
- Tool result tokens are not counted in `totalTokensEmitted` since they aren't streamed
- Speed changes take effect immediately by resetting segment timing anchors

`use-playback.ts` is the React hook that pre-tokenizes conversations (via `useMemo`), manages the engine lifecycle, and exposes `{ playbackState, play, pause, reset, setSpeed }`.

### Data Model (`src/types.ts`)

A `SampleConversation` contains `ConversationMessage[]`, each with `MessageSegment[]`. Segments are `"text"`, `"tool_call"` (with toolName + args), or `"tool_result"` (with toolName + output). This lets an assistant message be an interleaved sequence like `[text, tool_call, tool_result, text, ...]`.

### Conversations (`src/data/`)

Four hardcoded sample conversations covering chat, code explanation, agentic coding (with tool calls), and creative writing.

### UI

Two-column layout: sidebar (conversation selector, speed control with slider + text input + presets, playback controls) and main area (chat messages + stats bar). Light/dark mode toggled via class strategy, persisted to localStorage. Keyboard shortcuts: Space (play/pause), R (reset).

## Deployment

Deployed to Surge: `surge dist tokens-per-second-simulator.surge.sh`

OG image and meta tags use absolute URLs with base `https://tokens-per-second-simulator.surge.sh`.
