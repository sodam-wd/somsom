// workshop-ui 소유: 작업 JSON 저장/불러오기 (검증 실패 시 기존 작업 유지).
import { useRef, type ReactNode } from 'react';
import type { Scene } from '../types/scene';
import { downloadBlob, parseScene, sceneStore, serializeScene } from './engine';
import { notify } from './components/Notices';

export const MAX_WORK_FILE_BYTES = 60 * 1024 * 1024;

export function hasWork(scene: Scene): boolean {
  return scene.snowman.length > 0 || scene.world.length > 0 || Boolean(scene.profile.name);
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function saveWorkFile(): void {
  try {
    const scene = sceneStore.getState().scene;
    const blob = new Blob([serializeScene(scene)], { type: 'application/json' });
    downloadBlob(blob, `somsom-work-${stamp()}.json`);
    const hasPhoto = scene.snowman.some((l) => l.photo) || scene.innerBackground.kind === 'photo' || scene.outerBackground.kind === 'photo';
    notify('success', hasPhoto ? '작업 파일을 저장했어요. 넣은 사진이 파일 안에 함께 들어 있으니 공유할 때 주의해 주세요.' : '작업 파일을 저장했어요.');
  } catch (e) {
    notify('error', `작업 파일을 저장하지 못했어요. 다시 시도해 주세요. (${e instanceof Error ? e.message : String(e)})`);
  }
}

export async function openWorkFile(file: File): Promise<boolean> {
  if (file.size > MAX_WORK_FILE_BYTES) {
    notify('error', '파일이 너무 커요(60MB 초과). 기존 작업은 그대로예요.');
    return false;
  }
  const looksJson = /json|text/.test(file.type) || /\.json$/i.test(file.name) || file.type === '';
  if (!looksJson) {
    notify('error', 'somsom 작업 파일(.json)만 불러올 수 있어요. 기존 작업은 그대로예요.');
    return false;
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    notify('error', '파일을 읽지 못했어요. 권한을 확인하고 다시 시도해 주세요. 기존 작업은 그대로예요.');
    return false;
  }
  const res = parseScene(text);
  if (!res.ok) {
    notify('error', `작업 파일을 열 수 없어요: ${res.error} 기존 작업은 그대로예요.`);
    return false;
  }
  const cur = sceneStore.getState().scene;
  if (hasWork(cur) && !window.confirm('지금 작업을 불러온 파일로 바꿀까요? 저장하지 않은 현재 작업은 사라져요.')) {
    return false;
  }
  const loaded = res.value;
  sceneStore.loadScene(loaded);
  if (loaded.stage === 'welcome') sceneStore.setStage(loaded.snowman.length ? 'dress' : 'roll');
  notify('success', '작업 파일을 불러왔어요.');
  return true;
}

export function OpenWorkButton({ className, children }: { className?: string; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) void openWorkFile(f);
        }}
      />
    </>
  );
}
