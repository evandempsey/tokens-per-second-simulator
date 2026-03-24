export type MessageSegment =
  | { type: "text"; content: string }
  | { type: "tool_call"; toolName: string; args: string }
  | { type: "tool_result"; toolName: string; output: string };

export interface ConversationMessage {
  role: "user" | "assistant";
  segments: MessageSegment[];
}

export interface SampleConversation {
  id: string;
  title: string;
  description: string;
  category: "chat" | "code" | "agentic" | "creative";
  messages: ConversationMessage[];
}

export interface TokenizedSegment {
  type: MessageSegment["type"];
  tokens: number[];
  metadata?: {
    toolName: string;
    args?: string;
  };
}

export interface TokenizedMessage {
  role: "user" | "assistant";
  segments: TokenizedSegment[];
}

export interface RenderedSegment {
  type: MessageSegment["type"];
  text: string;
  isComplete: boolean;
  isStreaming: boolean;
  metadata?: { toolName: string; args?: string };
}

export interface RenderedMessage {
  role: "user" | "assistant";
  segments: RenderedSegment[];
}

export interface PlaybackState {
  status: "idle" | "playing" | "paused" | "finished";
  currentMessageIndex: number;
  currentSegmentIndex: number;
  currentTokenIndex: number;
  tokensPerSecond: number;
  totalTokensEmitted: number;
  elapsedMs: number;
  streamingElapsedMs: number;
  renderedMessages: RenderedMessage[];
}
