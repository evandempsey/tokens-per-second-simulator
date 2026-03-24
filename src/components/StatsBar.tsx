import { useRef } from "react";
import type { PlaybackState } from "../types";

interface StatsBarProps {
  state: PlaybackState;
  totalTokenCount: number;
}

const UPDATE_INTERVAL = 250; // ms between display updates
const EMA_ALPHA = 0.15; // smoothing factor (lower = smoother)

export function StatsBar({ state, totalTokenCount }: StatsBarProps) {
  const smoothedRef = useRef({ value: 0, display: "0.0", lastUpdate: 0 });

  const rawTps =
    state.streamingElapsedMs > 0
      ? state.totalTokensEmitted / (state.streamingElapsedMs / 1000)
      : 0;

  const now = performance.now();
  const ref = smoothedRef.current;

  if (state.status === "idle" || state.totalTokensEmitted === 0) {
    ref.value = 0;
    ref.display = "0.0";
    ref.lastUpdate = 0;
  } else if (now - ref.lastUpdate >= UPDATE_INTERVAL) {
    // Apply EMA
    if (ref.lastUpdate === 0) {
      ref.value = rawTps; // initialize on first update
    } else {
      ref.value = EMA_ALPHA * rawTps + (1 - EMA_ALPHA) * ref.value;
    }
    ref.display = ref.value.toFixed(1);
    ref.lastUpdate = now;
  }

  const elapsed = (state.elapsedMs / 1000).toFixed(1);

  return (
    <div className="flex border-t border-border bg-bg-secondary">
      <StatCell label="Target" value={`${state.tokensPerSecond}`} unit="tok/s" />
      <div className="w-px bg-border" />
      <StatCell label="Effective" value={ref.display} unit="tok/s" />
      <div className="w-px bg-border" />
      <StatCell
        label="Tokens"
        value={`${state.totalTokensEmitted}`}
        unit={`/ ${totalTokenCount}`}
      />
      <div className="w-px bg-border" />
      <StatCell label="Elapsed" value={elapsed} unit="s" />
    </div>
  );
}

function StatCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex-1 px-4 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-dim">
        {label}
      </div>
      <div className="mt-0.5">
        <span className="font-mono text-sm text-text-primary">{value}</span>
        <span className="ml-1 text-[10px] text-text-dim">{unit}</span>
      </div>
    </div>
  );
}
