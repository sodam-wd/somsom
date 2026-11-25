// workshop-ui 소유: 카테고리 목록 (PC 좌측 세로 / 모바일 서랍 상단 가로 칩).
import { useRef, type KeyboardEvent } from 'react';
import { useAsset } from '../../assets/loader';

export interface RailItem {
  id: string;
  label: string;
  /** 대표 썸네일 에셋 */
  iconAsset?: string;
  count?: number;
}

function RailIcon({ id }: { id?: string }) {
  const a = useAsset(id);
  if (!id) return <span className="rail__icon rail__icon--blank" aria-hidden="true" />;
  return a ? <img className="rail__icon" src={a.url} alt="" aria-hidden="true" /> : <span className="rail__icon" aria-hidden="true" />;
}

export function CategoryRail({ items, value, onChange, label }: { items: RailItem[]; value: string; onChange: (id: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = items.findIndex((x) => x.id === value);
    let n = i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % items.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = items.length - 1;
    onChange(items[n].id);
    const btn = ref.current?.querySelectorAll<HTMLButtonElement>('button')[n];
    btn?.focus();
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  return (
    <div ref={ref} className="rail" role="tablist" aria-label={label} aria-orientation="vertical" onKeyDown={onKey}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          className="rail__item"
          aria-selected={it.id === value}
          tabIndex={it.id === value ? 0 : -1}
          onClick={() => onChange(it.id)}
        >
          <RailIcon id={it.iconAsset} />
          <span className="rail__label">{it.label}</span>
          {it.count !== undefined && it.count > 0 && (
            <span className="rail__count" aria-label={`${it.count}개 사용 중`}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
