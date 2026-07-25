import type { Settings, ParseStats } from '@/types';

/** 현재 스키마 버전. 마이그레이션·백업 호환의 기준. */
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  share: true,
  clipboard: false,
  dedupe: true,
  cycleStart: 1,
  reachableFactor: 0.8,
  rawRetentionMonths: 12,
};

export const DEFAULT_STATS: ParseStats = {
  total: 0,
  ok: 0,
};
