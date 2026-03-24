import { cn } from "../lib/cn";
import type { RenderedSegment } from "../types";

interface ToolCallBlockProps {
  segment: RenderedSegment;
}

export function ToolCallBlock({ segment }: ToolCallBlockProps) {
  const isToolCall = segment.type === "tool_call";
  const isToolResult = segment.type === "tool_result";
  const toolName = segment.metadata?.toolName ?? "unknown";

  if (isToolResult) {
    return (
      <div className="my-2 rounded-r border-l-2 border-text-dim bg-bg-secondary p-3 animate-slide-up">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-text-secondary">
            {toolName}
          </span>
          <span className="ml-auto rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            Done
          </span>
        </div>
        <pre className="font-mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
          {segment.text}
        </pre>
      </div>
    );
  }

  if (isToolCall) {
    const isRunning = segment.isComplete && !segment.isStreaming;
    const isStreamingArgs = segment.isStreaming;

    return (
      <div
        className={cn(
          "my-2 rounded-r border-l-2 border-border-focus bg-bg-secondary p-3",
        )}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-text-secondary">
            {toolName}
          </span>
          {isStreamingArgs && (
            <span className="ml-auto text-[10px] text-text-dim">
              Streaming...
            </span>
          )}
          {isRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-text-dim">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px] border-text-dim border-t-transparent animate-spin" />
              Running...
            </span>
          )}
        </div>
        <pre className="font-mono text-xs leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
          {segment.text}
          {isStreamingArgs && (
            <span className="animate-cursor-blink text-text-primary">|</span>
          )}
        </pre>
      </div>
    );
  }

  return null;
}
