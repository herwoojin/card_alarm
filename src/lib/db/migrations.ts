import type Dexie from 'dexie';

/**
 * 스키마 버전 정의 + 마이그레이션. (TRD 6.2, ERD 6 규칙 8)
 *
 * 사용자 데이터가 서버에 없으므로 마이그레이션 실패는 곧 영구 소실이다.
 * 향후 버전 업그레이드 시:
 *   1) 업그레이드 직전 meta.snapshot 에 전체 JSON 백업을 남긴다 (규칙 8)
 *   2) version(n).stores({...}).upgrade(async (tx) => { ...데이터 변환... })
 *   3) 스냅샷은 snapshotBeforeUpgrade() 로 남긴다
 *
 * v1은 초기 스키마이므로 변환 로직이 없다.
 */
export function defineSchema(db: Dexie): void {
  db.version(1).stores({
    cards: 'id, issuer, last4, active',
    transactions: 'id, cardId, date, category, issuer, [cardId+date]',
    unrecognized: 'id, at',
    meta: 'key',
  });

  // 예시(향후):
  // db.version(2).stores({ ... }).upgrade(async (tx) => {
  //   await snapshotBeforeUpgrade(tx);
  //   // ...데이터 변환...
  // });
}

/**
 * 업그레이드 직전 전체 데이터를 meta.snapshot 에 JSON으로 저장한다. (규칙 8)
 * upgrade 콜백의 트랜잭션을 받아 그 안에서 실행한다.
 */
export async function snapshotBeforeUpgrade(tx: {
  table: (name: string) => { toArray: () => Promise<unknown[]>; put: (v: unknown) => Promise<unknown> };
}): Promise<void> {
  const [cards, transactions, unrecognized] = await Promise.all([
    tx.table('cards').toArray(),
    tx.table('transactions').toArray(),
    tx.table('unrecognized').toArray(),
  ]);
  await tx.table('meta').put({
    key: 'snapshot',
    value: JSON.stringify({ at: Date.now(), cards, transactions, unrecognized }),
  });
}
