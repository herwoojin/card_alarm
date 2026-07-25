import { create } from 'zustand';
import type {
  Card,
  Transaction,
  Unrecognized,
  Settings,
  ParseStats,
  CategoryName,
} from '@/types';
import { parseSMS, splitMessages } from '@/lib/parser';
import { matchCard } from '@/lib/db/matching';
import { uid } from '@/lib/id';
import { man } from '@/lib/format';
import {
  getCards,
  getTransactions,
  getUnrecognized,
  getSettings,
  getStats,
  setSettings as dbSetSettings,
  setStats as dbSetStats,
  putCard,
  deleteCard,
  putTxn,
  bulkPutTxns,
  deleteTxn,
  updateTxn,
  addUnrecognized,
  deleteUnrecognized,
  wipeAll,
  cleanup,
} from '@/lib/db/schema';
import { importAll, type ImportMode, type ImportResult } from '@/lib/db/backup';

/** 카드 에디터/템플릿에서 넘어오는 입력. id가 있으면 수정, 없으면 생성. */
export interface CardInput {
  id?: string;
  issuer: Card['issuer'];
  name: string;
  last4: string;
  annualFee: number;
  tiers: Card['tiers'];
  excludes: CategoryName[];
  rates: Card['rates'];
}

/** 미인식 문자 직접 입력 데이터. */
export interface ManualInput {
  cardId: string;
  amount: number;
  date: string; // ISO
  merchant: string;
  category: CategoryName;
}

export interface IngestSummary {
  ok: number;
  fail: number;
  dup: number;
}

interface AppState {
  ready: boolean;
  cards: Card[];
  transactions: Transaction[];
  unrecognized: Unrecognized[];
  stats: ParseStats;
  settings: Settings;

  init: () => Promise<void>;
  reloadAll: () => Promise<void>;

  ingest: (text: string) => Promise<IngestSummary>;
  saveCard: (input: CardInput) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  resolveManual: (unrecId: string, data: ManualInput) => Promise<void>;
  dropUnrecognized: (id: string) => Promise<void>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  wipe: () => Promise<void>;
  importBackup: (parsed: unknown, mode: ImportMode) => Promise<ImportResult>;
}

const dupKey = (t: Pick<Transaction, 'issuer' | 'amount' | 'date'>) => `${t.issuer}|${t.amount}|${t.date}`;

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  cards: [],
  transactions: [],
  unrecognized: [],
  stats: { total: 0, ok: 0 },
  settings: {
    share: true,
    clipboard: false,
    dedupe: true,
    cycleStart: 1,
    reachableFactor: 0.8,
    rawRetentionMonths: 12,
    cloudAutoBackup: false,
  },

  async init() {
    if (get().ready) return;
    await cleanup();
    await get().reloadAll();
    set({ ready: true });
  },

  async reloadAll() {
    const [cards, transactions, unrecognized, settings, stats] = await Promise.all([
      getCards(),
      getTransactions(),
      getUnrecognized(),
      getSettings(),
      getStats(),
    ]);
    set({ cards, transactions, unrecognized, settings, stats });
  },

  async ingest(text) {
    const { settings } = get();
    const existing = await getTransactions();
    const seen = new Set(existing.map(dupKey));
    const msgs = splitMessages(text);

    const stats = { ...get().stats };
    const newTxns: Transaction[] = [];
    const cards = await getCards();
    let ok = 0;
    let fail = 0;
    let dup = 0;

    for (const msg of msgs) {
      stats.total++;
      const r = parseSMS(msg);
      if (!r.ok) {
        await addUnrecognized({ id: uid(), raw: msg, reason: r.reason, at: Date.now(), resolvedTxnId: null });
        fail++;
        continue;
      }
      const t = r.txn;
      if (settings.dedupe && seen.has(dupKey(t))) {
        dup++;
        continue;
      }
      seen.add(dupKey(t));
      t.cardId = matchCard(t, cards);
      newTxns.push(t);
      stats.ok++;
      ok++;
    }

    if (newTxns.length) await bulkPutTxns(newTxns);
    await dbSetStats(stats);
    await get().reloadAll();
    return { ok, fail, dup };
  },

  async saveCard(input) {
    const nowISO = new Date().toISOString();
    let card: Card;
    if (input.id) {
      const prev = get().cards.find((c) => c.id === input.id);
      card = {
        ...(prev as Card),
        issuer: input.issuer,
        name: input.name,
        last4: input.last4,
        annualFee: input.annualFee,
        tiers: input.tiers,
        excludes: input.excludes,
        rates: input.rates,
        updatedAt: nowISO,
      };
    } else {
      card = {
        id: uid(),
        issuer: input.issuer,
        name: input.name || '새 카드',
        last4: input.last4,
        annualFee: input.annualFee,
        tiers: input.tiers,
        excludes: input.excludes,
        rates: input.rates,
        cycleStartDay: null,
        installmentPolicy: 'full',
        active: true,
        createdAt: nowISO,
        updatedAt: nowISO,
      };
    }
    await putCard(card);

    // 저장 직후 소급 매칭 — cardId가 null인 기존 거래를 다시 매칭 (ERD 5)
    const cards = await getCards();
    const txns = await getTransactions();
    await Promise.all(
      txns
        .filter((t) => !t.cardId)
        .map((t) => {
          const cid = matchCard(t, cards);
          return cid ? updateTxn(t.id, { cardId: cid }) : Promise.resolve();
        }),
    );

    await get().reloadAll();
  },

  async removeCard(id) {
    await deleteCard(id); // 규칙 2: 거래는 보존, cardId만 null
    await get().reloadAll();
  },

  async updateTransaction(id, patch) {
    await updateTxn(id, patch);
    await get().reloadAll();
  },

  async removeTransaction(id) {
    await deleteTxn(id);
    await get().reloadAll();
  },

  async resolveManual(unrecId, data) {
    const card = get().cards.find((c) => c.id === data.cardId);
    if (!card) throw new Error('카드를 먼저 등록하세요.');
    const unrec = get().unrecognized.find((u) => u.id === unrecId);
    const txn: Transaction = {
      id: uid(),
      cardId: card.id,
      issuer: card.issuer,
      issuerName: card.name,
      last4: card.last4,
      amount: data.amount,
      date: data.date,
      merchant: data.merchant || '가맹점 미상',
      category: data.category,
      installment: 0,
      canceled: false,
      cumulative: null,
      excludedManual: null,
      raw: unrec?.raw ?? '',
      source: 'manual',
      needsReview: false,
      createdAt: new Date().toISOString(),
    };
    await putTxn(txn);
    await deleteUnrecognized(unrecId);
    const stats = { ...get().stats, ok: get().stats.ok + 1 };
    await dbSetStats(stats);
    await get().reloadAll();
  },

  async dropUnrecognized(id) {
    await deleteUnrecognized(id);
    await get().reloadAll();
  },

  async setSetting(key, value) {
    const settings = await dbSetSettings({ [key]: value } as Partial<Settings>);
    set({ settings });
  },

  async wipe() {
    await wipeAll();
    await get().reloadAll();
  },

  async importBackup(parsed, mode) {
    const result = await importAll(parsed, mode);
    await get().reloadAll();
    return result;
  },
}));

/** 카드 저장 전 tiers 정규화 — min>0만 남기고 라벨 자동 생성, 오름차순 정렬. */
export function normalizeTiersInput(
  rows: { label: string; min: number; benefit: number }[],
): Card['tiers'] {
  return rows
    .filter((t) => t.min > 0)
    .map((t) => ({ label: t.label || man(t.min), min: t.min, benefit: t.benefit || 0 }))
    .sort((a, b) => a.min - b.min);
}
