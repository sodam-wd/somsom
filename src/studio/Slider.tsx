// studio-qa 소유 (T3). 라벨·값 표시·키보드 지원 슬라이더. 드래그/키 입력 시작·끝을 알려 undo 1단계로 묶는다.
import { useId, useRef } from 'react';

export interface SliderProps {
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

export const pct = (v: number) => `${Math.round(v * 100)}%`;

export function Slider({ label, value, min, max, step = 0.01, format = pct, onChange, onGestureStart, onGestureEnd, disabled }: SliderProps) {
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
  const text = format(value);
  return (
    <div className="st-slider">
      <label htmlFor={id} className="st-slider__label">
        <span>{label}</span>
        <output htmlFor={id} className="st-slider__value">{text}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) start();
        }}
        onKeyUp={end}
        onBlur={end}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
