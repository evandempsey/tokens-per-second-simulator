import { useState, useCallback, useEffect } from "react";
import { conversations } from "./data";
import { usePlayback } from "./engine/use-playback";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { StatsBar } from "./components/StatsBar";
import { PlaybackControls } from "./components/PlaybackControls";

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem("darkMode");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [speed, setSpeed] = useState(50);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const conversation = conversations.find((c) => c.id === selectedId)!;
  const {
    playbackState,
    totalTokenCount,
    play,
    pause,
    reset,
    setSpeed: engineSetSpeed,
  } = usePlayback(conversation, speed);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((d) => !d);
  }, []);

  const handleSpeedChange = useCallback(
    (tps: number) => {
      setSpeed(tps);
      engineSetSpeed(tps);
    },
    [engineSetSpeed],
  );

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSidebarOpen(false);
      reset();
    },
    [reset],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (playbackState.status === "playing") {
          pause();
        } else {
          play();
        }
      } else if (e.code === "KeyR") {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playbackState.status, play, pause, reset]);

  return (
    <div className="flex h-full flex-col md:flex-row bg-bg-primary overflow-x-hidden">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary px-4 py-2.5 md:hidden">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded border border-border text-text-secondary hover:text-text-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-text-primary">
          Tokens per Second
        </span>
        <PlaybackControls
          status={playbackState.status}
          onPlay={play}
          onPause={pause}
          onReset={reset}
        />
      </div>

      <Sidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelectConversation={handleSelectConversation}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        status={playbackState.status}
        onPlay={play}
        onPause={pause}
        onReset={reset}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatArea
          messages={playbackState.renderedMessages}
          status={playbackState.status}
        />
        <StatsBar state={playbackState} totalTokenCount={totalTokenCount} />
      </div>
    </div>
  );
}
