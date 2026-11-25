// editor-engine 소유 (T1). 눈 입자 (world 논리 좌표, 내부 클립 안에서 그림).
import { LOGICAL_SIZE } from '../types/scene';
import { seededRandom } from './pixels';
import { SNOW_FLOOR_Y } from './globe';

export interface Flake { x: number; y: number; vx: number; vy: number; r: number; settled: boolean; phase: number }

const LEFT = 100;
const RIGHT = LOGICAL_SIZE - 100;

/** 결정적 입자 생성 (정지 시 바닥에 쌓인 상태) */
export function createFlakes(count: number, seed = 7): Flake[] {
  const rnd = seededRandom(seed);
  const out: Flake[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: LEFT + rnd() * (RIGHT - LEFT),
      y: SNOW_FLOOR_Y + rnd() * 30 - 6,
      vx: 0,
      vy: 0,
      r: 5 + rnd() * 7,
      settled: true,
      phase: rnd() * Math.PI * 2,
    });
  }
  return out;
}

/** 흔들기: 바닥의 눈을 위로 흩뿌림 */
export function shakeFlakes(flakes: Flake[], strength = 1, seed = Date.now()): void {
  const rnd = seededRandom(seed);
  for (const f of flakes) {
    f.settled = false;
    f.vx = (rnd() - 0.5) * 700 * strength;
    f.vy = -(350 + rnd() * 750) * strength;
  }
}

/** dt 초 만큼 진행. 반환: 아직 움직이는 입자가 있으면 true */
export function stepFlakes(flakes: Flake[], dt: number, time: number): boolean {
  const step = Math.min(0.05, Math.max(0, dt));
  let moving = false;
  for (const f of flakes) {
    if (f.settled) continue;
    moving = true;
    // 물속 같은 강한 감쇠 + 약한 중력 + 흔들림
    const drag = Math.exp(-2.6 * step);
    f.vx *= drag;
    f.vy = f.vy * drag + 60 * step;
    if (f.vy > 0) f.vy = Math.min(f.vy, 70 + f.r * 6);
    f.x += (f.vx + Math.sin(time * 1.3 + f.phase) * 14) * step;
    f.y += f.vy * step;
    if (f.x < LEFT) { f.x = LEFT; f.vx = Math.abs(f.vx) * 0.4; }
    if (f.x > RIGHT) { f.x = RIGHT; f.vx = -Math.abs(f.vx) * 0.4; }
    if (f.y < 60) { f.y = 60; f.vy = Math.abs(f.vy) * 0.3; }
    const floor = SNOW_FLOOR_Y + (f.phase / (Math.PI * 2)) * 24 - 6;
    if (f.y >= floor && f.vy > 0) {
      f.y = floor;
      f.vx = 0;
      f.vy = 0;
      f.settled = true;
    }
  }
  return moving;
}

/** 정지 이미지용 결정적 부유 입자 (t ∈ 0..1 순환) */
export function floatingFlakesAt(t: number, count = 40, seed = 11): Flake[] {
  const rnd = seededRandom(seed);
  const out: Flake[] = [];
  for (let i = 0; i < count; i++) {
    const x0 = LEFT + rnd() * (RIGHT - LEFT);
    const y0 = rnd();
    const r = 2.5 + rnd() * 4.5;
    const phase = rnd() * Math.PI * 2;
    const y = 80 + (((y0 + t) % 1) * (SNOW_FLOOR_Y - 80));
    out.push({ x: x0 + Math.sin(t * Math.PI * 2 + phase) * 18, y, vx: 0, vy: 0, r, settled: false, phase });
  }
  return out;
}

export function drawFlakes(ctx: CanvasRenderingContext2D, flakes: Flake[]): void {
  ctx.save();
  for (const f of flakes) {
    const g = ctx.createRadialGradient(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.1, f.x, f.y, f.r);
    g.addColorStop(0, 'rgba(254, 252, 247, 0.98)');
    g.addColorStop(0.75, 'rgba(245, 240, 230, 0.9)');
    g.addColorStop(1, 'rgba(229, 218, 203, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
