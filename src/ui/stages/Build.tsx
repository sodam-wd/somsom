// workshop-ui 소유: Build — 유리 용기 3종·받침대 2종·풍경/친구 배치·내부 배경·흔들기 미리보기.
import { useState } from 'react';
import { assetsInCategory } from '../../assets/manifest';
import { CONTAINERS, type BaseId, type ContainerId } from '../../types/scene';
import { BackgroundEditor, EditorCanvas, SnowGlobeView, sceneStore, useEditor, useSelectedLayer } from '../engine';
import { AssetTile } from '../components/AssetTile';
import { CategoryRail, type RailItem } from '../components/CategoryRail';
import { Icon } from '../components/Icon';
import { LayerControls, QuickActions } from '../components/LayerControls';
import { announce } from '../components/Notices';
import { WorkLayout } from '../components/WorkLayout';
import { BASE_LABELS, CONTAINER_LABELS, assetLabel } from '../labels';
import { useIsDesktop } from '../hooks';
import { worldPlacement } from '../placement';

type Section = 'container' | 'base' | 'landscape' | 'friends' | 'inner';
const SECTIONS: { id: Section; label: string; iconAsset?: string }[] = [
  { id: 'container', label: '유리 용기', iconAsset: 'A059' },
  { id: 'base', label: '받침대', iconAsset: 'A062' },
  { id: 'landscape', label: '풍경', iconAsset: 'A048' },
  { id: 'friends', label: '친구들', iconAsset: 'A044' },
  { id: 'inner', label: '내부 배경', iconAsset: 'BG02' },
];

export function GlobeBench({ mode, setMode, shakeKey, onShake }: { mode: 'edit' | 'preview'; setMode: (m: 'edit' | 'preview') => void; shakeKey: number; onShake: () => void }) {
  const world = useEditor((s) => s.scene.world.length);
  return (
    <div className="bench bench-oak bench--globe">
      <div className="segmented" role="radiogroup" aria-label="보기 방식">
        <button type="button" role="radio" aria-checked={mode === 'edit'} onClick={() => setMode('edit')}>
          배치 편집
        </button>
        <button type="button" role="radio" aria-checked={mode === 'preview'} onClick={() => setMode('preview')}>
          미리보기
        </button>
      </div>
      <div className="square-fit">
        {mode === 'edit' ? (
          <EditorCanvas
            target="world"
            showContainer
            className="editor-canvas"
            onDropAsset={(id, x, y) => {
              const lid = sceneStore.addLayer('world', id, { ...worldPlacement(id, sceneStore.getState().scene.world), x, y });
              if (lid) sceneStore.select(lid);
            }}
          />
        ) : (
          <SnowGlobeView className="globe-view" shakeKey={shakeKey} interactive={false} />
        )}
        {mode === 'edit' && world === 0 && (
          <div className="canvas-empty canvas-empty--low" aria-hidden="true">
            풍경이나 친구를 골라 유리 안에 배치해 보세요
          </div>
        )}
      </div>
      <button type="button" className="btn btn--primary shake-btn" onClick={onShake}>
        <Icon name="shake" /> 흔들기
      </button>
    </div>
  );
}

export function Build() {
  const [section, setSection] = useState<Section>('container');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [shakeKey, setShakeKey] = useState(0);
  const desktop = useIsDesktop();
  const containerId = useEditor((s) => s.scene.containerId);
  const baseId = useEditor((s) => s.scene.baseId);
  const world = useEditor((s) => s.scene.world);
  const sel = useSelectedLayer();
  const worldSel = sel && sel.target === 'world' ? sel : null;

  const count = (cat: string) => {
    const ids = new Set(assetsInCategory(cat).map((a) => a.id));
    return world.filter((l) => ids.has(l.assetId)).length;
  };
  const items: RailItem[] = SECTIONS.map((s) => ({
    ...s,
    count: s.id === 'landscape' || s.id === 'friends' ? count(s.id) : undefined,
  }));

  const addWorld = (id: string) => {
    const lid = sceneStore.addLayer('world', id, worldPlacement(id, sceneStore.getState().scene.world));
    if (lid) sceneStore.select(lid);
    setMode('edit');
    announce(`${assetLabel(id)}을(를) 스노우볼에 추가했어요`);
  };

  const shake = () => {
    setMode('preview');
    setShakeKey((k) => k + 1);
    announce('스노우볼을 흔들었어요');
  };

  let list;
  if (section === 'container') {
    list = (
      <div className="tile-grid tile-grid--choice" role="radiogroup" aria-label="유리 용기">
        {(Object.keys(CONTAINERS) as ContainerId[]).map((id) => (
          <AssetTile
            key={id}
            id={CONTAINERS[id].back}
            overlayIds={[CONTAINERS[id].front]}
            label={CONTAINER_LABELS[id]}
            pressed={containerId === id}
            onPick={() => sceneStore.setContainer(id)}
            size="lg"
          />
        ))}
      </div>
    );
  } else if (section === 'base') {
    list = (
      <div className="base-pick">
        <div className="tile-grid tile-grid--choice" role="radiogroup" aria-label="받침대">
          {(['A062', 'A063'] as BaseId[]).map((id) => (
            <AssetTile key={id} id={id} label={BASE_LABELS[id]} pressed={baseId === id} onPick={() => sceneStore.setBase(id)} size="lg" />
          ))}
        </div>
        <BaseColorPicker />
      </div>
    );
  } else if (section === 'inner') {
    list = (
      <div className="bg-editor-wrap">
        <p className="hint">유리 안쪽 배경이에요. 바깥 촬영 배경과 따로 편집돼요.</p>
        <BackgroundEditor which="inner" />
      </div>
    );
  } else {
    list = (
      <div className="tile-grid" role="list" aria-label={section === 'landscape' ? '풍경 재료' : '친구 재료'}>
        {assetsInCategory(section).map((a) => (
          <div role="listitem" key={a.id}>
            <AssetTile id={a.id} onPick={addWorld} draggable={desktop && mode === 'edit'} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <WorkLayout
      canvas={<GlobeBench mode={mode} setMode={setMode} shakeKey={shakeKey} onShake={shake} />}
      rail={<CategoryRail items={items} value={section} onChange={(v) => setSection(v as Section)} label="스노우볼 구성" />}
      list={
        <>
          {desktop && <h2 className="list-title">{SECTIONS.find((s) => s.id === section)?.label}</h2>}
          {list}
        </>
      }
      controls={
        worldSel ? (
          <LayerControls />
        ) : (
          <div className="empty-panel">
            <span className="empty-panel__art" aria-hidden="true" />
            <p>배치 편집에서 풍경이나 친구를 탭하면 위치·크기·색을 조절할 수 있어요. 눈사람은 꾸미기 단계에서 편집해요.</p>
          </div>
        )
      }
      floating={worldSel ? <QuickActions layer={worldSel.layer} compact /> : null}
      controlsBadge={Boolean(worldSel)}
      listLabel="구성"
      controlsLabel="조절"
    />
  );
}

const BASE_SWATCHES = [
  { c: '#fefcf7', n: '양모 흰색' },
  { c: '#e5dacb', n: '오트' },
  { c: '#78634f', n: '코코아' },
  { c: '#aab8a0', n: '세이지' },
  { c: '#bdd5df', n: '스노우블루' },
  { c: '#bd716b', n: '베리' },
  { c: '#e2a3a0', n: '분홍' },
  { c: '#3b3029', n: '먹색' },
];

/** 받침대 색: 원목 그대로 또는 팔레트/직접 고르기 (나뭇결 명암은 유지) */
function BaseColorPicker() {
  const color = useEditor((s) => s.scene.baseColor);
  return (
    <fieldset className="color-control base-color">
      <legend>
        <Icon name="palette" size={18} /> 받침 색
      </legend>
      <div className="swatches" role="group" aria-label="받침 색">
        <button
          type="button"
          className="swatch swatch--wood"
          aria-label="원목 그대로"
          title="원목 그대로"
          aria-pressed={!color}
          onClick={() => sceneStore.setBaseColor(null)}
        />
        {BASE_SWATCHES.map((s) => (
          <button
            key={s.c}
            type="button"
            className="swatch"
            style={{ background: s.c }}
            aria-label={s.n}
            title={s.n}
            aria-pressed={color === s.c}
            onClick={() => sceneStore.setBaseColor(s.c)}
          />
        ))}
        <label className="color-input" title="직접 고르기">
          <span>직접</span>
          <input type="color" value={color ?? '#c9a27a'} onChange={(e) => sceneStore.setBaseColor(e.currentTarget.value)} />
        </label>
      </div>
    </fieldset>
  );
}
