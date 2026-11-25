// workshop-ui 소유: 선택 객체 조절 — 이동/크기/회전 슬라이더, 반전, 복제, 삭제, 레이어 순서, 색상, 사진 보정.
import { useEffect, useState } from 'react';
import { PHOTO_ASSET_ID, LOGICAL_SIZE, type Layer } from '../../types/scene';
import type { ZMove } from '../../types/contracts';
import { PhotoAdjustPanel, sceneStore, useSelectedLayer } from '../engine';
import { assetLabel } from '../labels';
import { Icon, type IconName } from './Icon';
import { RangeField } from './RangeField';

const gesture = {
  onGestureStart: () => sceneStore.beginGesture(),
  onGestureEnd: () => sceneStore.endGesture(),
};

export function layerName(layer: Layer): string {
  return layer.assetId === PHOTO_ASSET_ID ? '얼굴 사진' : assetLabel(layer.assetId);
}

export function QuickActions({ layer, compact }: { layer: Layer; compact?: boolean }) {
  const z = (m: ZMove) => sceneStore.moveLayerZ(layer.id, m);
  const actions: { icon: IconName; label: string; run: () => void; danger?: boolean }[] = [
    { icon: 'flip', label: '좌우 반전', run: () => sceneStore.updateLayer(layer.id, { flipX: !layer.flipX }) },
    {
      icon: 'copy',
      label: '복제',
      run: () => {
        const id = sceneStore.duplicateLayer(layer.id);
        if (id) sceneStore.select(id);
      },
    },
    { icon: 'up', label: '앞으로', run: () => z('up') },
    { icon: 'down', label: '뒤로', run: () => z('down') },
    { icon: 'top', label: '맨 앞으로', run: () => z('top') },
    { icon: 'bottom', label: '맨 뒤로', run: () => z('bottom') },
    { icon: 'trash', label: '삭제', run: () => sceneStore.removeLayer(layer.id), danger: true },
  ];
  return (
    <div className={`quick-actions${compact ? ' quick-actions--compact' : ''}`} role="toolbar" aria-label={`${layerName(layer)} 빠른 조절`}>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className={`icon-btn${a.danger ? ' icon-btn--danger' : ''}`}
          onClick={a.run}
          aria-label={a.label}
          title={a.label}
          aria-pressed={a.icon === 'flip' ? layer.flipX : undefined}
        >
          <Icon name={a.icon} />
          {!compact && <span className="icon-btn__text">{a.label}</span>}
        </button>
      ))}
    </div>
  );
}

const SWATCHES = [
  { c: '#FEFCF7', n: '양모 흰색' },
  { c: '#E5DACB', n: '오트' },
  { c: '#91765E', n: '오크' },
  { c: '#78634F', n: '코코아' },
  { c: '#AAB8A0', n: '세이지' },
  { c: '#7F9277', n: '짙은 세이지' },
  { c: '#BDD5DF', n: '스노우블루' },
  { c: '#BD716B', n: '베리' },
  { c: '#D98A4E', n: '당근' },
  { c: '#C9A55A', n: '꿀빛' },
  { c: '#E2A3A0', n: '분홍' },
  { c: '#3B3029', n: '먹색' },
];

export function ColorControl({ layer }: { layer: Layer }) {
  const [custom, setCustom] = useState(layer.tint ?? '#bd716b');
  useEffect(() => {
    if (layer.tint) setCustom(layer.tint);
  }, [layer.tint]);
  return (
    <fieldset className="color-control">
      <legend>
        <Icon name="palette" size={18} /> 색상
      </legend>
      <div className="swatches" role="group" aria-label="팔레트">
        {SWATCHES.map((s) => (
          <button
            key={s.c}
            type="button"
            className="swatch"
            style={{ background: s.c }}
            aria-label={s.n}
            title={s.n}
            aria-pressed={layer.tint?.toLowerCase() === s.c.toLowerCase()}
            onClick={() => sceneStore.setTint(layer.id, s.c.toLowerCase())}
          />
        ))}
      </div>
      <div className="color-row">
        <label className="color-input">
          <span>직접 고르기</span>
          <input
            type="color"
            value={custom}
            onChange={(e) => setCustom(e.currentTarget.value)}
            onBlur={(e) => sceneStore.setTint(layer.id, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sceneStore.setTint(layer.id, e.currentTarget.value);
            }}
          />
        </label>
        <button type="button" className="btn btn--small" onClick={() => sceneStore.setTint(layer.id, custom)}>
          적용
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => sceneStore.setTint(layer.id, null)} disabled={!layer.tint}>
          <Icon name="reset" size={18} /> 원래 색
        </button>
      </div>
      <p className="hint">밝기와 섬유 질감은 그대로 두고 색만 바꿔요.</p>
    </fieldset>
  );
}

export function TransformControls({ layer }: { layer: Layer }) {
  const scale = Math.abs(layer.scaleX);
  return (
    <fieldset className="transform-controls">
      <legend>
        <Icon name="move" size={18} /> 위치·크기·회전
      </legend>
      <RangeField label="가로 위치" min={0} max={LOGICAL_SIZE} value={layer.x} onChange={(x) => sceneStore.updateLayer(layer.id, { x })} {...gesture} />
      <RangeField label="세로 위치" min={0} max={LOGICAL_SIZE} value={layer.y} onChange={(y) => sceneStore.updateLayer(layer.id, { y })} {...gesture} />
      <RangeField
        label="크기"
        min={0.1}
        max={4}
        step={0.01}
        value={scale}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => sceneStore.updateLayer(layer.id, { scaleX: v, scaleY: v * (Math.abs(layer.scaleY) / (scale || 1)) })}
        {...gesture}
      />
      <RangeField
        label="회전"
        min={-180}
        max={180}
        value={layer.rotation > 180 ? layer.rotation - 360 : layer.rotation}
        format={(v) => `${Math.round(v)}°`}
        onChange={(rotation) => sceneStore.updateLayer(layer.id, { rotation })}
        {...gesture}
      />
    </fieldset>
  );
}

/** 우측 조절 패널 / 모바일 '조절' 탭 내용 */
export function LayerControls({ allowTint = true }: { allowTint?: boolean }) {
  const sel = useSelectedLayer();
  if (!sel) {
    return (
      <div className="empty-panel">
        <span className="empty-panel__art" aria-hidden="true" />
        <p>작업대에서 부품을 탭하면 여기에서 위치·크기·색을 조절할 수 있어요.</p>
      </div>
    );
  }
  const { layer } = sel;
  const isPhoto = layer.assetId === PHOTO_ASSET_ID && layer.photo;
  return (
    <div className="layer-controls">
      <div className="layer-controls__head">
        <h3>{layerName(layer)}</h3>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => sceneStore.select(null)}>
          선택 해제
        </button>
      </div>
      <QuickActions layer={layer} />
      <TransformControls layer={layer} />
      {isPhoto && layer.photo && (
        <section className="photo-adjust" aria-label="얼굴 사진 보정">
          <PhotoAdjustPanel
            photo={layer.photo}
            onChange={(patch) => sceneStore.updatePhoto(layer.id, patch)}
            onGestureStart={() => sceneStore.beginGesture()}
            onGestureEnd={() => sceneStore.endGesture()}
          />
        </section>
      )}
      {allowTint && !isPhoto && <ColorControl layer={layer} />}
    </div>
  );
}
