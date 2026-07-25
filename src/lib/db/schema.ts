import Dexie, { type Table } from 'dexie';
import type { Card, Transaction, Unrecognized, Settings, ParseStats } from '@/types';
import { defineSchema } from './migrations';
import { DEFAULT_SETTINGS, DEFAULT_STATS } from './defaults';

interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * IndexedDB(Dexie) 저장 계층. (TRD 6, ERD 6)
 * 브라우저에서만 인스턴스화한다 — SSR 중에는 indexedDB가 없으므로 getDb()로 지연 생성.
 */
class SiljeokDB extends Dexie {
  cards!: Table<Card, string>;
  transactions!: Table<Transaction, string>;
  unrecognized!: Table<Unrecognized, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('siljeokon');
    defineSchema(this);
  }
}

let _db: SiljeokDB | null = null;

/** Dexie 인스턴스를 지연 생성해 반환한다. 클라이언트에서만 호출할 것. */
export function getDb(): SiljeokDB {
  if (!_db) _db = new SiljeokDB();
  return _db;
}

/* ── 무결성 정규화 (ERD 6) ─────────────────────────── */

/** 규칙 5: last4는 숫자 4자리이거나 빈 문자열. */
export function sanitizeLast4(v: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 4);
}

/** 규칙 1·5: 카드 저장 전 정규화 — tiers min 오름차순, last4 정제, updatedAt 갱신. */
export function normalizeCard(card: Card): Card {
  return {
    ...card,
    last4: sanitizeLast4(card.last4),
    tiers: (card.tiers || []).slice().sort((a, b) => a.min - b.min),
    updatedAt: new Date().toISOString(),
  };
}

/** 규칙 3·4: 거래 저장 전 정규화 — amount 0 금지, canceled면 음수 보장. */
export function normalizeTxn(txn: Transaction): Transaction {
  if (!txn.amount || txn.amount === 0) {
    throw new Error('amount는 0이 될 수 없습니다 (ERD 무결성 규칙 3)');
  }
  const amount = txn.canceled ? -Math.abs(txn.amount) : txn.amount;
  return { ...txn, amount, last4: sanitizeLast4(txn.last4) };
}

/* ── cards CRUD ────────────────────────────────────── */

export async function getCards(): Promise<Card[]> {
  return getDb().cards.toArray();
}

export async function putCard(card: Card): Promise<void> {
  await getDb().cards.put(normalizeCard(card));
}

/** 규칙 2: 카드 삭제 시 거래를 지우지 않고 cardId만 null로 만든다. */
export async function deleteCard(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.cards, db.transactions, async () => {
    const affected = await db.transactions.where('cardId').equals(id).toArray();
    await Promise.all(affected.map((t) => db.transactions.update(t.id, { cardId: null })));
    await db.cards.delete(id);
  });
}

/* ── transactions CRUD ─────────────────────────────── */

export async function getTransactions(): Promise<Transaction[]> {
  return getDb().transactions.toArray();
}

export async function putTxn(txn: Transaction): Promise<void> {
  await getDb().transactions.put(normalizeTxn(txn));
}

export async function bulkPutTxns(txns: Transaction[]): Promise<void> {
  await getDb().transactions.bulkPut(txns.map(normalizeTxn));
}

export async function deleteTxn(id: string): Promise<void> {
  await getDb().transactions.delete(id);
}

export async function updateTxn(id: string, patch: Partial<Transaction>): Promise<void> {
  await getDb().transactions.update(id, patch);
}

/* ── unrecognized CRUD (규칙 6: 최대 30건) ──────────── */

export async function getUnrecognized(): Promise<Unrecognized[]> {
  return getDb().unrecognized.orderBy('at').reverse().toArray();
}

export async function addUnrecognized(u: Unrecognized): Promise<void> {
  const db = getDb();
  await db.unrecognized.put(u);
  await trimUnrecognized();
}

export async function deleteUnrecognized(id: string): Promise<void> {
  await getDb().unrecognized.delete(id);
}

async function trimUnrecognized(): Promise<void> {
  const db = getDb();
  const all = await db.unrecognized.orderBy('at').reverse().toArray();
  if (all.length > 30) {
    const drop = all.slice(30).map((u) => u.id);
    await db.unrecognized.bulkDelete(drop);
  }
}

/* ── meta (settings / stats) ───────────────────────── */

async function getMeta<T>(key: string): Promise<T | null> {
  const row = await getDb().meta.get(key);
  return row ? (row.value as T) : null;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await getDb().meta.put({ key, value });
}

/** 기본값 병합 후 반환. */
export async function getSettings(): Promise<Settings> {
  const stored = await getMeta<Partial<Settings>>('settings');
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const merged = { ...(await getSettings()), ...patch };
  await setMeta('settings', merged);
  return merged;
}

export async function getStats(): Promise<ParseStats> {
  const stored = await getMeta<Partial<ParseStats>>('stats');
  return { ...DEFAULT_STATS, ...(stored ?? {}) };
}

export async function setStats(stats: ParseStats): Promise<void> {
  await setMeta('stats', stats);
}

export async function getLastBackupAt(): Promise<number | null> {
  return getMeta<number>('lastBackupAt');
}

export async function setLastBackupAt(at: number): Promise<void> {
  await setMeta('lastBackupAt', at);
}

/* ── 시작 시 정리 작업 (규칙 6·7) ──────────────────── */

/**
 * 앱 시작 시 정리:
 * - 규칙 7: rawRetentionMonths 지난 거래의 raw를 빈 문자열로
 * - 규칙 6: unrecognized 30건 초과분 삭제
 */
export async function cleanup(now: Date = new Date()): Promise<void> {
  const db = getDb();
  const settings = await getSettings();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - settings.rawRetentionMonths, now.getDate()).getTime();

  const stale = await db.transactions.filter((t) => !!t.raw && new Date(t.date).getTime() < cutoff).toArray();
  await Promise.all(stale.map((t) => db.transactions.update(t.id, { raw: '' })));

  await trimUnrecognized();
}

/** 전체 삭제 (되돌릴 수 없음). */
export async function wipeAll(): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.cards, db.transactions, db.unrecognized, db.meta, async () => {
    await Promise.all([db.cards.clear(), db.transactions.clear(), db.unrecognized.clear(), db.meta.clear()]);
  });
}
