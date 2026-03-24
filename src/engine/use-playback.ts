import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type {
  SampleConversation,
  TokenizedMessage,
  PlaybackState,
} from "../types";
import { tokenize } from "./tokenizer";
import { PlaybackEngine } from "./playback-engine";

function tokenizeConversation(
  conversation: SampleConversation,
): TokenizedMessage[] {
  return conversation.messages.map((msg) => ({
    role: msg.role,
    segments: msg.segments.map((seg) => {
      const content =
        seg.type === "text"
          ? seg.content
          : seg.type === "tool_call"
            ? seg.args
            : seg.output;
      return {
        type: seg.type,
        tokens: tokenize(content),
        metadata:
          seg.type === "tool_call" || seg.type === "tool_result"
            ? { toolName: seg.toolName }
            : undefined,
      };
    }),
  }));
}

const initialState: PlaybackState = {
  status: "idle",
  currentMessageIndex: 0,
  currentSegmentIndex: 0,
  currentTokenIndex: 0,
  tokensPerSecond: 50,
  totalTokensEmitted: 0,
  elapsedMs: 0,
  streamingElapsedMs: 0,
  renderedMessages: [],
};

export function usePlayback(
  conversation: SampleConversation,
  initialSpeed: number = 50,
) {
  const [playbackState, setPlaybackState] =
    useState<PlaybackState>(initialState);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const speedRef = useRef(initialSpeed);

  const tokenizedMessages = useMemo(
    () => tokenizeConversation(conversation),
    [conversation],
  );

  // Total token count for this conversation (assistant segments only)
  const totalTokenCount = useMemo(
    () =>
      tokenizedMessages
        .filter((m) => m.role === "assistant")
        .reduce(
          (sum, m) => sum + m.segments.reduce((s, seg) => s + seg.tokens.length, 0),
          0,
        ),
    [tokenizedMessages],
  );

  // Create engine when conversation changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const engine = new PlaybackEngine(
      tokenizedMessages,
      speedRef.current,
      (state) => {
        setPlaybackState(state);
      },
    );

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [tokenizedMessages]);

  const play = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  const setSpeed = useCallback((tps: number) => {
    speedRef.current = tps;
    engineRef.current?.setSpeed(tps);
  }, []);

  return {
    playbackState,
    totalTokenCount,
    play,
    pause,
    reset,
    setSpeed,
  };
}
