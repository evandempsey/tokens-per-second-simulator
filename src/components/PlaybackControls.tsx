import { cn } from "../lib/cn";
import type { PlaybackState } from "../types";

interface PlaybackControlsProps {
  status: PlaybackState["status"];
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function PlaybackControls({
  status,
  onPlay,
  onPause,
  onReset,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Play */}
      <button
        onClick={onPlay}
        disabled={status === "playing"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded border transition-all duration-150",
          status === "playing"
            ? "border-text-primary bg-text-primary text-bg-primary"
            : "border-border text-text-secondary hover:border-border-focus hover:text-text-primary",
        )}
        title="Play (Space)"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2.5v11l10-5.5L4 2.5z" />
        </svg>
      </button>

      {/* Pause */}
      <button
        onClick={onPause}
        disabled={status !== "playing"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded border transition-all duration-150",
          status === "paused"
            ? "border-text-primary text-text-primary"
            : status === "playing"
              ? "border-border text-text-secondary hover:border-border-focus hover:text-text-primary"
              : "border-border text-text-dim cursor-not-allowed opacity-40",
        )}
        title="Pause (Space)"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="3" y="2" width="4" height="12" rx="1" />
          <rect x="9" y="2" width="4" height="12" rx="1" />
        </svg>
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        disabled={status === "idle"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded border transition-all duration-150",
          status === "idle"
            ? "border-border text-text-dim cursor-not-allowed opacity-40"
            : "border-border text-text-secondary hover:border-border-focus hover:text-text-primary",
        )}
        title="Reset (R)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8a6 6 0 1 1 1.76 4.24" />
          <path d="M2 12V8h4" />
        </svg>
      </button>
    </div>
  );
}
