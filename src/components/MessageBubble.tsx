import { cn } from "../lib/cn";
import type { RenderedMessage } from "../types";
import { StreamingText } from "./StreamingText";
import { ToolCallBlock } from "./ToolCallBlock";

interface MessageBubbleProps {
  message: RenderedMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("space-y-1", isUser ? "max-w-[70%]" : "max-w-[85%]")}>
        <span className="block text-[10px] font-medium uppercase tracking-wider text-text-dim">
          {isUser ? "User" : "Assistant"}
        </span>

        <div
          className={cn(
            "rounded-lg border p-4",
            isUser
              ? "rounded-br-sm border-border bg-bg-tertiary"
              : "rounded-bl-sm border-border bg-bg-secondary",
          )}
        >
          {message.segments.map((segment, i) => {
            if (segment.type === "text") {
              return (
                <StreamingText
                  key={i}
                  text={segment.text}
                  isStreaming={segment.isStreaming}
                />
              );
            }
            return <ToolCallBlock key={i} segment={segment} />;
          })}
        </div>
      </div>
    </div>
  );
}
