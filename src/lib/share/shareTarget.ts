/**
 * Web Share Target 진입 처리. (TRD 3.2 A, 보안 3)
 * 부팅 시 location.search의 text를 읽어 ingest에 넣고, 처리 후 쿼리를 제거한다.
 * 브라우저 히스토리에 결제 정보가 남으면 안 되므로 replaceState로 지운다.
 */
export function readSharedText(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  return q.get('text') || q.get('title');
}

export function clearShareQuery(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
}
