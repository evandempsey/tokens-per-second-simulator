import type { PlaybackState } from "../types";

interface StatsBarProps {
  state: PlaybackState;
  totalTokenCount: number;
}

export function StatsBar({ state, totalTokenCount }: StatsBarProps) {
  const effectiveTps =
    state.streamingElapsedMs > 0
      ? (state.totalTokensEmitted / (state.streamingElapsedMs / 1000)).toFixed(1)
      : "0.0";

  const elapsed = (state.elapsedMs / 1000).toFixed(1);

  return (
    <div className="flex border-t border-border bg-bg-secondary">
      <StatCell label="Target" value={`${state.tokensPerSecond}`} unit="tok/s" />
      <div className="w-px bg-border" />
      <StatCell label="Effective" value={effectiveTps} unit="tok/s" />
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
