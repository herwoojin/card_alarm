/** 실적 주기 계산. 순수 함수. (TRD 5.1) */

export interface CycleRange {
  start: Date;
  end: Date;
}

/** 해당 연·월의 일수. */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * (year, monthIndex, startDay)로 주기 시작 시각을 만든다.
 * startDay가 그 달에 없으면(예: 2월 31일) 말일로 보정한다.
 * monthIndex 오버/언더플로우는 Date 생성자가 정규화한다.
 */
function cycleStartFor(year: number, monthIndex: number, startDay: number): Date {
  // 먼저 정규화된 연/월을 구한다
  const normalized = new Date(year, monthIndex, 1);
  const y = normalized.getFullYear();
  const m = normalized.getMonth();
  const day = Math.min(startDay, daysInMonth(y, m));
  return new Date(y, m, day, 0, 0, 0, 0);
}

/**
 * 현재 시각이 속한 실적 주기의 [start, end)를 반환한다.
 * startDay가 29~31이고 해당 월에 그 날짜가 없으면 말일로 보정한다.
 */
export function cycleRange(now: Date, startDay: number): CycleRange {
  let start = cycleStartFor(now.getFullYear(), now.getMonth(), startDay);
  if (now.getTime() < start.getTime()) {
    start = cycleStartFor(now.getFullYear(), now.getMonth() - 1, startDay);
  }
  const end = cycleStartFor(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}

/** 주기 종료까지 남은 일수. 최소 1(0으로 나누는 것을 막는다). */
export function daysLeft(now: Date, range: CycleRange): number {
  return Math.max(1, Math.ceil((range.end.getTime() - now.getTime()) / 86_400_000));
}

/** 주기 전체 일수. */
export function totalDays(range: CycleRange): number {
  return Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000));
}

/** 거래가 이 주기 안에 있는지. [start, end) */
export function inRange(dateISO: string, range: CycleRange): boolean {
  const t = new Date(dateISO).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}
