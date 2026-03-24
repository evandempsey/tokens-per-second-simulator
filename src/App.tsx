import { useState, useCallback, useEffect } from "react";
import { conversations } from "./data";
import { usePlayback } from "./engine/use-playback";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { StatsBar } from "./components/StatsBar";

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem("darkMode");
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [selectedId, setSelectedId] = useState(conversations[0].id);
  const [speed, setSpeed] = useState(50);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  const conversation = conversations.find((c) => c.id === selectedId)!;
  const {
    playbackState,
    totalTokenCount,
    play,
    pause,
    reset,
    setSpeed: engineSetSpeed,
  } = usePlayback(conversation, speed);

  // Apply dark mode class to html element
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
    <div className="flex h-full bg-bg-primary">
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
