import { useState, useEffect } from "react";
import { cn } from "../lib/cn";

const PRESETS = [
  { value: 8 },
  { value: 25 },
  { value: 50 },
  { value: 100 },
  { value: 200 },
];

interface SpeedControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function SpeedControl({ speed, onSpeedChange }: SpeedControlProps) {
  const [inputValue, setInputValue] = useState(String(speed));

  useEffect(() => {
    setInputValue(String(speed));
  }, [speed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(500, parsed));
      onSpeedChange(clamped);
      setInputValue(String(clamped));
    } else {
      setInputValue(String(speed));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          Tokens per second
        </span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={500}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="w-16 rounded border border-border bg-bg-primary px-2 py-1 text-right font-mono text-sm text-text-primary outline-none focus:border-border-focus"
          />
          <span className="text-xs text-text-dim">tok/s</span>
        </div>
      </div>

      <input
        type="range"
        min={1}
        max={500}
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="w-full"
      />

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onSpeedChange(preset.value)}
            className={cn(
              "rounded border px-2 py-1 text-xs transition-all duration-150",
              speed === preset.value
                ? "border-text-primary bg-text-primary text-bg-primary font-medium"
                : "border-border text-text-secondary hover:border-border-focus hover:text-text-primary",
            )}
          >
            {preset.value}
          </button>
        ))}
      </div>
    </div>
  );
}
