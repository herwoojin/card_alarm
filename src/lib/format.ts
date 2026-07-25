/** 금액·조사·날짜 표시 유틸. 모두 순수 함수. */

/** 원 단위 정수를 천단위 구분 문자열로. 표시 시에만 사용한다. */
export function won(n: number): string {
  return Math.round(n || 0).toLocaleString('ko-KR');
}

/** 10,000 이상은 "N만" 형태로 축약. (구간 라벨 자동 생성 등) */
export function man(n: number): string {
  if (n >= 10000) {
    return (n / 10000).toFixed(n % 10000 ? 1 : 0).replace(/\.0$/, '') + '만';
  }
  return won(n);
}

/**
 * 받침 유무에 따라 조사를 고른다 — "신한카드는" / "국민카드는" 같은 어색함 방지.
 * pair = [받침있을때, 받침없을때]. 예: ['은','는'], ['으로','로'], ['이','가'].
 */
export function josa(word: string, pair: [string, string]): string {
  const s = String(word || '');
  if (!s) return '';
  const ch = s.charCodeAt(s.length - 1);
  const isHangul = ch >= 0xac00 && ch <= 0xd7a3;
  const jong = isHangul ? (ch - 0xac00) % 28 : -1;
  // '으로/로'는 ㄹ 받침(jong 8)도 '로'를 쓴다
  if (pair[1] === '로' && jong === 8) return s + pair[1];
  const hasBatchim = isHangul ? jong !== 0 : /[0-9lmnrLMNR]$/.test(s.slice(-1));
  return s + (hasBatchim ? pair[0] : pair[1]);
}

/** ISO 문자열을 "M/DD HH:MM"으로. */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
