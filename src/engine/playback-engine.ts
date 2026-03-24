import type {
  TokenizedMessage,
  RenderedMessage,
  PlaybackState,
} from "../types";
import { detokenize } from "./tokenizer";

const TICK_INTERVAL = 16; // ~60fps
const TOOL_EXECUTION_DELAY = 800; // ms to simulate tool execution

export type PlaybackCallback = (state: PlaybackState) => void;

export class PlaybackEngine {
  private tokenizedMessages: TokenizedMessage[] = [];
  private tokensPerSecond = 50;
  private status: PlaybackState["status"] = "idle";

  private currentMessageIndex = 0;
  private currentSegmentIndex = 0;
  private currentTokenIndex = 0;
  private totalTokensEmitted = 0;

  private startTime = 0;
  private pausedElapsed = 0;
  private elapsedMs = 0;
  private streamingElapsedMs = 0; // only time spent streaming (excludes tool delays)
  private lastTickTime = 0;
  private segmentStartTokens = 0;
  private segmentStartTime = 0; // based on streamingElapsedMs, not wall-clock

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private toolDelayTimeout: ReturnType<typeof setTimeout> | null = null;
  private waitingForToolDelay = false;

  private callback: PlaybackCallback;
  private renderedMessages: RenderedMessage[] = [];

  constructor(
    tokenizedMessages: TokenizedMessage[],
    tokensPerSecond: number,
    callback: PlaybackCallback,
  ) {
    this.tokenizedMessages = tokenizedMessages;
    this.tokensPerSecond = tokensPerSecond;
    this.callback = callback;
    this.buildInitialRenderedState();
    this.emitState();
  }

  private buildInitialRenderedState() {
    this.renderedMessages = [];
  }

  play() {
    if (this.status === "playing") return;
    if (this.status === "finished") return;

    const now = performance.now();

    if (this.status === "idle") {
      this.startTime = now;
      this.lastTickTime = now;
      this.pausedElapsed = 0;
      this.segmentStartTime = 0;
      this.segmentStartTokens = 0;
      this.advancePastUserMessages();
    }

    if (this.status === "paused") {
      this.startTime = now - this.pausedElapsed;
      this.lastTickTime = now;
    }

    this.status = "playing";

    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL);
    this.emitState();
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    this.pausedElapsed = performance.now() - this.startTime;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.toolDelayTimeout) {
      clearTimeout(this.toolDelayTimeout);
      this.toolDelayTimeout = null;
    }
    this.emitState();
  }

  reset() {
    this.stop();
    this.status = "idle";
    this.currentMessageIndex = 0;
    this.currentSegmentIndex = 0;
    this.currentTokenIndex = 0;
    this.totalTokensEmitted = 0;
    this.elapsedMs = 0;
    this.streamingElapsedMs = 0;
    this.lastTickTime = 0;
    this.pausedElapsed = 0;
    this.segmentStartTokens = 0;
    this.segmentStartTime = 0;
    this.waitingForToolDelay = false;
    this.renderedMessages = [];
    this.emitState();
  }

  setSpeed(tps: number) {
    this.tokensPerSecond = tps;
    if (this.status === "playing") {
      this.segmentStartTime = this.streamingElapsedMs;
      this.segmentStartTokens = this.totalTokensEmitted;
    }
    this.emitState();
  }

  destroy() {
    this.stop();
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.toolDelayTimeout) {
      clearTimeout(this.toolDelayTimeout);
      this.toolDelayTimeout = null;
    }
  }

  private tick() {
    if (this.status !== "playing") return;

    const now = performance.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;

    this.elapsedMs = now - this.startTime;

    // Only accumulate streaming time when not waiting for tool delay
    if (this.waitingForToolDelay) return;

    this.streamingElapsedMs += delta;

    const msg = this.tokenizedMessages[this.currentMessageIndex];
    if (!msg) {
      this.finish();
      return;
    }

    const segment = msg.segments[this.currentSegmentIndex];
    if (!segment) {
      this.advanceMessage();
      return;
    }

    // Calculate how many tokens should have been emitted based on streaming time
    const segmentElapsed =
      (this.streamingElapsedMs - this.segmentStartTime) / 1000;
    const expectedTotal =
      this.segmentStartTokens +
      Math.floor(segmentElapsed * this.tokensPerSecond);
    const tokensToEmit = expectedTotal - this.totalTokensEmitted;

    if (tokensToEmit <= 0) return;

    const segmentTokenCount = segment.tokens.length;
    const remainingInSegment = segmentTokenCount - this.currentTokenIndex;
    const actualEmit = Math.min(tokensToEmit, remainingInSegment);

    this.currentTokenIndex += actualEmit;
    this.totalTokensEmitted += actualEmit;

    this.updateRenderedSegment();

    if (this.currentTokenIndex >= segmentTokenCount) {
      this.markCurrentSegmentComplete();

      if (segment.type === "tool_call") {
        this.waitingForToolDelay = true;
        this.toolDelayTimeout = setTimeout(() => {
          this.waitingForToolDelay = false;
          this.lastTickTime = performance.now();
          this.advanceSegment();
          this.tryRenderToolResult();
        }, TOOL_EXECUTION_DELAY);
      } else {
        this.advanceSegment();
      }
    }

    this.emitState();
  }

  private tryRenderToolResult() {
    const msg = this.tokenizedMessages[this.currentMessageIndex];
    if (!msg) return;

    const segment = msg.segments[this.currentSegmentIndex];
    if (!segment || segment.type !== "tool_result") return;

    // Render tool result all at once — don't count these in totalTokensEmitted
    // since they weren't streamed (they appear instantly)
    this.currentTokenIndex = segment.tokens.length;
    this.updateRenderedSegment();
    this.markCurrentSegmentComplete();
    this.advanceSegment();
    this.emitState();
  }

  private advancePastUserMessages() {
    while (this.currentMessageIndex < this.tokenizedMessages.length) {
      const msg = this.tokenizedMessages[this.currentMessageIndex];
      if (msg.role === "user") {
        this.renderUserMessageFully(this.currentMessageIndex);
        this.currentMessageIndex++;
        this.currentSegmentIndex = 0;
        this.currentTokenIndex = 0;
      } else {
        this.ensureRenderedMessage(this.currentMessageIndex);
        this.ensureRenderedSegment(
          this.currentMessageIndex,
          this.currentSegmentIndex,
        );
        break;
      }
    }
  }

  private advanceSegment() {
    const msg = this.tokenizedMessages[this.currentMessageIndex];
    if (!msg) return;

    this.currentSegmentIndex++;
    this.currentTokenIndex = 0;
    this.segmentStartTime = this.streamingElapsedMs;
    this.segmentStartTokens = this.totalTokensEmitted;

    if (this.currentSegmentIndex >= msg.segments.length) {
      this.advanceMessage();
    } else {
      this.ensureRenderedSegment(
        this.currentMessageIndex,
        this.currentSegmentIndex,
      );
    }
  }

  private advanceMessage() {
    this.currentMessageIndex++;
    this.currentSegmentIndex = 0;
    this.currentTokenIndex = 0;
    this.segmentStartTime = this.streamingElapsedMs;
    this.segmentStartTokens = this.totalTokensEmitted;

    if (this.currentMessageIndex >= this.tokenizedMessages.length) {
      this.finish();
      return;
    }

    this.advancePastUserMessages();
  }

  private finish() {
    this.status = "finished";
    this.stop();
    this.emitState();
  }

  private renderUserMessageFully(msgIndex: number) {
    const msg = this.tokenizedMessages[msgIndex];
    const rendered: RenderedMessage = {
      role: "user",
      segments: msg.segments.map((seg) => ({
        type: seg.type,
        text: detokenize(seg.tokens),
        isComplete: true,
        isStreaming: false,
        metadata: seg.metadata,
      })),
    };
    this.renderedMessages.push(rendered);
  }

  private ensureRenderedMessage(msgIndex: number) {
    while (this.renderedMessages.length <= msgIndex) {
      const msg = this.tokenizedMessages[this.renderedMessages.length];
      this.renderedMessages.push({
        role: msg.role,
        segments: [],
      });
    }
  }

  private ensureRenderedSegment(msgIndex: number, segIndex: number) {
    this.ensureRenderedMessage(msgIndex);
    const rendered = this.renderedMessages[msgIndex];
    const tokenized = this.tokenizedMessages[msgIndex];

    while (rendered.segments.length <= segIndex) {
      const seg = tokenized.segments[rendered.segments.length];
      rendered.segments.push({
        type: seg.type,
        text: "",
        isComplete: false,
        isStreaming: true,
        metadata: seg.metadata,
      });
    }
  }

  private updateRenderedSegment() {
    this.ensureRenderedSegment(
      this.currentMessageIndex,
      this.currentSegmentIndex,
    );
    const rendered =
      this.renderedMessages[this.currentMessageIndex].segments[
        this.currentSegmentIndex
      ];
    const tokenized =
      this.tokenizedMessages[this.currentMessageIndex].segments[
        this.currentSegmentIndex
      ];

    const tokensSlice = tokenized.tokens.slice(0, this.currentTokenIndex);
    rendered.text = detokenize(tokensSlice);
    rendered.isStreaming = this.currentTokenIndex < tokenized.tokens.length;
  }

  private markCurrentSegmentComplete() {
    const rendered =
      this.renderedMessages[this.currentMessageIndex]?.segments[
        this.currentSegmentIndex
      ];
    if (rendered) {
      rendered.isComplete = true;
      rendered.isStreaming = false;
    }
  }

  private emitState() {
    this.callback({
      status: this.status,
      currentMessageIndex: this.currentMessageIndex,
      currentSegmentIndex: this.currentSegmentIndex,
      currentTokenIndex: this.currentTokenIndex,
      tokensPerSecond: this.tokensPerSecond,
      totalTokensEmitted: this.totalTokensEmitted,
      elapsedMs: this.elapsedMs,
      streamingElapsedMs: this.streamingElapsedMs,
      renderedMessages: this.renderedMessages.map((m) => ({
        ...m,
        segments: m.segments.map((s) => ({ ...s })),
      })),
    });
  }
}
