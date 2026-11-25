// workshop-ui 소유: 재료 타일 (탭=추가, PC 드래그 앤 드롭). 임시 에셋은 '임시' 표시.
import type { DragEvent, ReactNode } from 'react';
import { useAsset } from '../../assets/loader';
import { assetLabel } from '../labels';

export const DND_MIME = 'application/x-somsom-asset';

interface Props {
  id: string;
  onPick?: (id: string) => void;
  draggable?: boolean;
  pressed?: boolean;
  /** 썸네일을 겹쳐 그릴 추가 에셋 (예: 유리 후면+전면) */
  overlayIds?: string[];
  label?: string;
  children?: ReactNode;
  size?: 'md' | 'lg';
}

function Thumb({ id }: { id: string }) {
  const a = useAsset(id);
  if (!a) return <span className="tile__skeleton" aria-hidden="true" />;
  return <img className="tile__img" src={a.url} alt="" draggable={false} decoding="async" />;
}

export function PlaceholderBadge({ id }: { id: string }) {
  const a = useAsset(id);
  if (!a?.isPlaceholder) return null;
  return (
    <span className="badge-temp" title="실제 PNG 미생성 — 임시 에셋 표시 중">
      임시
    </span>
  );
}

export function AssetTile({ id, onPick, draggable, pressed, overlayIds, label, children, size = 'md' }: Props) {
  const name = label ?? assetLabel(id);
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DND_MIME, id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <button
      type="button"
      className={`tile tile--${size}`}
      onClick={() => onPick?.(id)}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      aria-pressed={pressed}
      aria-label={pressed === undefined ? `${name} 추가` : name}
      title={name}
    >
      <span className="tile__frame">
        <Thumb id={id} />
        {overlayIds?.map((o) => (
          <span key={o} className="tile__overlay">
            <Thumb id={o} />
          </span>
        ))}
        <PlaceholderBadge id={id} />
        {pressed && <span className="tile__check" aria-hidden="true">✓</span>}
      </span>
      <span className="tile__name">{name}</span>
      {children}
    </button>
  );
}
