/**
 * 클립보드 자동 감지. (TRD 3.2 B)
 * visibilitychange에서 설정이 켜져 있을 때만 readText()를 시도한다.
 * 직전 텍스트를 캐시해 중복 팝업을 막고, 실패는 조용히 무시한다(Safari는 거부).
 */
let lastClip = '';

/** 클립보드를 읽어 직전과 다른 새 텍스트면 반환, 아니면 null. 실패 시 null. */
export async function readClipboardOnce(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null;
  try {
    const t = await navigator.clipboard.readText();
    if (!t || t === lastClip) return null;
    lastClip = t;
    return t;
  } catch {
    // 사용자 제스처 없는 읽기 거부 등 — 조용히 무시
    return null;
  }
}
