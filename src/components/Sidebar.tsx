import { cn } from "../lib/cn";
import type { SampleConversation, PlaybackState } from "../types";
import { SpeedControl } from "./SpeedControl";
import { PlaybackControls } from "./PlaybackControls";

const CATEGORY_LABELS: Record<string, string> = {
  chat: "Chat",
  code: "Code",
  agentic: "Agent",
  creative: "Creative",
};

interface SidebarProps {
  conversations: SampleConversation[];
  selectedId: string;
  onSelectConversation: (id: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  status: PlaybackState["status"];
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  conversations,
  selectedId,
  onSelectConversation,
  speed,
  onSpeedChange,
  status,
  onPlay,
  onPause,
  onReset,
  darkMode,
  onToggleDarkMode,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <div
        className={cn(
          // Desktop: always visible fixed sidebar
          "md:flex md:h-full md:w-[340px] md:flex-shrink-0 md:flex-col md:border-r md:border-border md:bg-bg-secondary md:relative md:z-auto",
          // Mobile: slide-down overlay panel
          "fixed inset-x-0 top-0 z-50 flex h-[85vh] flex-col border-b border-border bg-bg-secondary transition-transform duration-200 md:translate-y-0",
          mobileOpen ? "translate-y-0" : "-translate-y-full md:translate-y-0",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              Tokens per Second
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              See what local LLM inference speeds feel like
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleDarkMode}
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:border-border-focus hover:text-text-primary"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {/* Mobile close button */}
            <button
              onClick={onMobileClose}
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:border-border-focus hover:text-text-primary md:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto px-3">
          {conversations.map((conv) => {
            const isActive = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  "w-full rounded border p-3 text-left transition-all duration-150",
                  isActive
                    ? "border-l-2 border-l-text-primary border-t-border border-r-border border-b-border bg-bg-tertiary"
                    : "border-border hover:border-border-focus hover:bg-bg-tertiary",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {conv.title}
                  </span>
                  <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-medium text-text-dim">
                    {CATEGORY_LABELS[conv.category]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                  {conv.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="space-y-4 border-t border-border p-5">
          <SpeedControl speed={speed} onSpeedChange={onSpeedChange} />

          <div className="flex items-center justify-between">
            <PlaybackControls
              status={status}
              onPlay={onPlay}
              onPause={onPause}
              onReset={onReset}
            />
            <span className="hidden text-[10px] text-text-dim md:inline">
              Space: play/pause · R: reset
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
