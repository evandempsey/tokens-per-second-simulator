import { useEffect, useRef } from "react";
import type { RenderedMessage, PlaybackState } from "../types";
import { MessageBubble } from "./MessageBubble";

interface ChatAreaProps {
  messages: RenderedMessage[];
  status: PlaybackState["status"];
}

export function ChatArea({ messages, status }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="custom-scrollbar h-full overflow-y-auto p-6 space-y-4"
      >
        {messages.length === 0 && status === "idle" && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-sm text-text-secondary">
                Select a conversation and press play
              </p>
              <p className="text-xs text-text-dim">
                Adjust the speed to feel the difference
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
      </div>
    </div>
  );
}
