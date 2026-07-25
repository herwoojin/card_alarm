/** 짧은 고유 ID 생성. 로컬 전용이므로 충돌 확률이 낮은 간단한 방식으로 충분하다. */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
