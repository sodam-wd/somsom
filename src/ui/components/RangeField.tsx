// workshop-ui 소유: 제스처 대안 슬라이더. 포인터 드래그 동안은 한 번의 undo 단계로 묶는다.
import { useId, useRef } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  disabled?: boolean;
}

export function RangeField({ label, value, min, max, step = 1, format, onChange, onGestureStart, onGestureEnd, disabled }: Props) {
  const id = useId();
  const active = useRef(false);
  const start = () => {
    if (active.current) return;
    active.current = true;
    onGestureStart?.();
  };
  const end = () => {
    if (!active.current) return;
    active.current = false;
    onGestureEnd?.();
  };
  const shown = format ? format(value) : String(Math.round(value));
  return (
    <div className="range">
      <div className="range__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{shown}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        disabled={disabled}
        aria-valuetext={shown}
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onBlur={end}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
