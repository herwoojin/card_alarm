import type { Card, Transaction, Unrecognized, Settings, ParseStats } from '@/types';
import { SCHEMA_VERSION } from './defaults';
import {
  getCards,
  getTransactions,
  getUnrecognized,
  getSettings,
  getStats,
  putCard,
  bulkPutTxns,
  addUnrecognized,
  setSettings,
  setStats,
  setLastBackupAt,
  wipeAll,
} from './schema';

/** 백업 파일 포맷 (ERD 7). */
export interface BackupFile {
  app: 'siljeokon';
  schemaVersion: number;
  exportedAt: string;
  cards: Card[];
  transactions: Transaction[];
  unrecognized: Unrecognized[];
  meta: { settings: Settings; stats: ParseStats };
}

/** 전체 DB를 백업 객체로 직렬화. */
export async function buildBackup(): Promise<BackupFile> {
  const [cards, transactions, unrecognized, settings, stats] = await Promise.all([
    getCards(),
    getTransactions(),
    getUnrecognized(),
    getSettings(),
    getStats(),
  ]);
  return {
    app: 'siljeokon',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    cards,
    transactions,
    unrecognized,
    meta: { settings, stats },
  };
}

/** 백업 JSON을 파일로 내려받는다. 파일명 siljeokon-backup-YYYYMMDD.json */
export async function exportAll(): Promise<void> {
  const data = await buildBackup();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `siljeokon-backup-${ymd}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await setLastBackupAt(Date.now());
}

export type ImportMode = 'merge' | 'overwrite';

export interface ImportResult {
  cards: number;
  transactions: number;
  skippedDuplicates: number;
}

function isBackupFile(v: unknown): v is BackupFile {
  return !!v && typeof v === 'object' && (v as { app?: unknown }).app === 'siljeokon';
}

/** 거래 중복 판정 키 (issuer, amount, date). */
function dupKey(t: Pick<Transaction, 'issuer' | 'amount' | 'date'>): string {
  return `${t.issuer}|${t.amount}|${t.date}`;
}

/**
 * 백업 파일을 가져온다. (ERD 7 검증)
 * 1) app 필드 확인 → 2) schemaVersion 확인 → 3) 병합/덮어쓰기 → 4) 병합 시 중복 판정 키로 필터
 */
export async function importAll(parsed: unknown, mode: ImportMode): Promise<ImportResult> {
  if (!isBackupFile(parsed)) {
    throw new Error('실적ON 백업 파일이 아닙니다.');
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error('더 최신 버전에서 만든 백업입니다. 앱을 업데이트한 뒤 다시 시도하세요.');
  }

  if (mode === 'overwrite') {
    await wipeAll();
  }

  const existing = mode === 'merge' ? await getTransactions() : [];
  const seen = new Set(existing.map(dupKey));

  let txnCount = 0;
  let skipped = 0;
  const toInsert: Transaction[] = [];
  for (const t of parsed.transactions ?? []) {
    if (mode === 'merge' && seen.has(dupKey(t))) {
      skipped++;
      continue;
    }
    seen.add(dupKey(t));
    toInsert.push(t);
    txnCount++;
  }

  await Promise.all((parsed.cards ?? []).map((c) => putCard(c)));
  if (toInsert.length) await bulkPutTxns(toInsert);
  await Promise.all((parsed.unrecognized ?? []).map((u) => addUnrecognized(u)));

  if (parsed.meta) {
    if (parsed.meta.settings) await setSettings(parsed.meta.settings);
    if (parsed.meta.stats) await setStats(parsed.meta.stats);
  }

  return { cards: (parsed.cards ?? []).length, transactions: txnCount, skippedDuplicates: skipped };
}

/** File → 파싱된 백업 객체. */
export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}
