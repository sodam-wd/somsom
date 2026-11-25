// workshop-ui 소유: Dress — 재료 서랍 + 중앙 편집 캔버스 + 선택 객체 조절 + 얼굴 사진.
import { useMemo, useRef, useState } from 'react';
import { assetsInCategory } from '../../assets/manifest';
import { PHOTO_ASSET_ID } from '../../types/scene';
import { EditorCanvas, loadPhotoFile, sceneStore, useEditor, useSelectedLayer } from '../engine';
import { AssetTile } from '../components/AssetTile';
import { CategoryRail, type RailItem } from '../components/CategoryRail';
import { Icon } from '../components/Icon';
import { LayerControls, QuickActions } from '../components/LayerControls';
import { announce, clearErrors, notify } from '../components/Notices';
import { WorkLayout } from '../components/WorkLayout';
import { CATEGORY_LABELS, assetLabel } from '../labels';
import { useIsDesktop } from '../hooks';
import { snowmanPlacement } from '../placement';

export const DRESS_CATEGORIES = ['body', 'eyes', 'nose', 'mouth', 'blush', 'hat', 'scarf', 'arms', 'clothes', 'decor', 'props', 'friends'] as const;

function PhotoPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File) => {
    setBusy(true);
    try {
      const res = await loadPhotoFile(file);
      if (!res.ok) {
        notify('error', `${res.error} 기존 작업은 그대로예요.`, { label: '다시 고르기', run: () => input.current?.click() });
        return;
      }
      const id = sceneStore.addPhotoLayer(res.value);
      if (id) sceneStore.select(id);
      clearErrors();
      notify('success', '얼굴 사진을 넣었어요. 조절 패널에서 자르기·색감·경계를 다듬어 보세요.');
    } catch (e) {
      notify('error', `사진을 불러오지 못했어요. 다시 시도해 주세요. (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="photo-panel">
      <p>
        원하는 얼굴 사진을 골라 눈사람 얼굴에 펠트처럼 합성해요. 부드러운 경계, 채도·밝기·대비, 양모 질감을 조절할 수 있어요. (AI 변환이 아닌 2D
        합성이에요)
      </p>
      <button type="button" className="btn btn--primary" onClick={() => input.current?.click()} disabled={busy} aria-busy={busy}>
        <Icon name="photo" /> {busy ? '사진 준비 중…' : '얼굴 사진 고르기'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) void pick(f);
        }}
      />
      <p className="hint">JPG·PNG·WebP(최대 15MB). 사진은 이 기기 안에서만 처리되고, 작업 파일(JSON)에 함께 저장돼요.</p>
    </div>
  );
}

export function SnowmanBench({ onDrop }: { onDrop: (id: string, x: number, y: number) => void }) {
  const count = useEditor((s) => s.scene.snowman.length);
  return (
    <div className="bench bench-oak">
      <div className="square-fit display-mat">
        <EditorCanvas target="snowman" className="editor-canvas" onDropAsset={onDrop} />
        {count === 0 && (
          <div className="canvas-empty" aria-hidden="true">
            <span className="canvas-empty__art" />
            아직 눈덩이가 없어요. 몸통을 고르거나 굴리기 단계에서 만들어 보세요.
          </div>
        )}
      </div>
    </div>
  );
}

export function Dress() {
  const [cat, setCat] = useState<string>('body');
  const desktop = useIsDesktop();
  const snowman = useEditor((s) => s.scene.snowman);
  const sel = useSelectedLayer();

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of snowman) {
      const c = l.assetId === PHOTO_ASSET_ID ? 'photo' : l.assetId;
      m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [snowman]);

  const items: RailItem[] = [
    ...DRESS_CATEGORIES.map((c) => {
      const list = assetsInCategory(c);
      return { id: c, label: CATEGORY_LABELS[c], iconAsset: list[0]?.id, count: list.reduce((n, a) => n + (counts[a.id] ?? 0), 0) };
    }),
    { id: 'photo', label: CATEGORY_LABELS.photo, count: counts.photo ?? 0 },
  ];

  const add = (id: string, init?: { x: number; y: number }) => {
    const auto = snowmanPlacement(id, sceneStore.getState().scene.snowman);
    const lid = sceneStore.addLayer('snowman', id, init ? { ...auto, ...init } : auto);
    if (lid) sceneStore.select(lid);
    announce(`${assetLabel(id)}을(를) 추가했어요`);
  };

  const list =
    cat === 'photo' ? (
      <PhotoPanel />
    ) : (
      <div className="tile-grid" role="list" aria-label={`${CATEGORY_LABELS[cat]} 재료`}>
        {assetsInCategory(cat).map((a) => (
          <div role="listitem" key={a.id}>
            <AssetTile id={a.id} onPick={(id) => add(id)} draggable={desktop} />
          </div>
        ))}
      </div>
    );

  return (
    <WorkLayout
      canvas={<SnowmanBench onDrop={(id, x, y) => add(id, { x, y })} />}
      rail={<CategoryRail items={items} value={cat} onChange={setCat} label="꾸미기 재료 종류" />}
      list={
        <>
          {desktop && <h2 className="list-title">{CATEGORY_LABELS[cat]} — 탭하거나 작업대로 끌어다 놓기</h2>}
          {list}
        </>
      }
      controls={<LayerControls />}
      floating={sel ? <QuickActions layer={sel.layer} compact /> : null}
      controlsBadge={Boolean(sel)}
      listLabel="재료"
      controlsLabel="조절"
    />
  );
}
