interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  if (!text && !isStreaming) return null;

  return (
    <span className="font-mono text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words">
      {text}
      {isStreaming && (
        <span className="animate-cursor-blink text-text-primary">|</span>
      )}
    </span>
  );
}
