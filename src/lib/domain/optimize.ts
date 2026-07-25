import type { Card, CategoryName, IssuerKey, Transaction } from '@/types';
import { won, josa } from '@/lib/format';
import { computePerformance, type Performance } from './performance';
import { daysLeft, totalDays, type CycleRange } from './cycle';

/** 도달 가능성 판정 계수. 사용자가 약간의 노력을 더한다는 가정. 튜닝 대상. (TRD 5.3) */
export const DEFAULT_REACHABLE_FACTOR = 0.8;

export type ActionType = 'over' | 'fill-need' | 'ok';

export interface Action {
  type: ActionType;
  cardId: string;
  cardName: string;
  /** 이 조치의 대상 카드사(딥링크용) */
  issuer: IssuerKey;
  /** over 유형에서 옮겨갈 대체 카드의 카드사(딥링크용). 없으면 null */
  altIssuer: IssuerKey | null;
  /** 화면 제목 */
  title: string;
  /** 화면 본문(순수 텍스트. HTML 아님) */
  body: string;
  /** 예상 이득(원). over면 대체 카드의 nextGain, fill-need면 nextGain, ok면 0 */
  gain: number;
  /** 다음 구간까지 필요액(원) */
  need: number;
  /** 하루 필요액(원) */
  perDay: number;
  /** 현재 속도로 도달 가능한가 */
  reachable: boolean;
  /** 대체 카드명 (over 유형에서 옮겨갈 카드) */
  altCardName: string | null;
}

export interface CardPerf {
  card: Card;
  perf: Performance;
}

export interface OptimizeResult {
  actions: Action[];
  rows: CardPerf[];
  /** 이번 주기의 타깃(가장 가까운 미달 카드). 없으면 null */
  target: CardPerf | null;
}

/**
 * 최적화 조치를 생성한다. 순수 함수. (TRD 5.3)
 * @param cards 활성 카드 후보(비활성은 호출 측에서 걸러도 되고 여기서도 거른다)
 * @param txns 전체 거래
 * @param range 이번 주기
 * @param now 기준 시각
 * @param factor 도달 가능성 계수
 */
export function optimize(
  cards: Card[],
  txns: Transaction[],
  range: CycleRange,
  now: Date,
  factor: number = DEFAULT_REACHABLE_FACTOR,
): OptimizeResult {
  const active = cards.filter((c) => c.active !== false);
  const rows: CardPerf[] = active.map((card) => ({ card, perf: computePerformance(card, txns, range) }));

  // 미달 카드를 "다음 구간까지 남은 금액" 오름차순 정렬 → 1순위가 이번 주기 타깃
  const short = rows
    .filter((r) => r.perf.next)
    .sort((a, b) => a.perf.next!.min - a.perf.sum - (b.perf.next!.min - b.perf.sum));
  const target = short[0] ?? null;

  const left = daysLeft(now, range);
  const tDays = totalDays(range);
  const elapsed = Math.max(1, tDays - left);

  const actions: Action[] = [];

  for (const { card, perf } of rows) {
    // 최고 구간 초과 → over
    if (!perf.next && perf.top) {
      const alt = short.find((s) => s.card.id !== card.id) ?? null;
      const altNeed = alt ? alt.perf.next!.min - alt.perf.sum : 0;
      const withParticle = (name: string) => josa(name, ['으로', '로']);
      actions.push({
        type: 'over',
        cardId: card.id,
        cardName: card.name,
        issuer: card.issuer,
        altIssuer: alt ? alt.card.issuer : null,
        title: `${card.name} — 최고 구간 달성, 지금부터는 손해`,
        body: alt
          ? `이번 주기 ${won(perf.sum)}원으로 최고 구간(${won(perf.top.min)}원)을 ${won(perf.overflow)}원 넘겼습니다. ` +
            `남은 결제는 ${withParticle(alt.card.name)} 옮기세요. ` +
            `${won(altNeed)}원만 더 쓰면 ${alt.perf.next!.label} 구간이 열립니다.`
          : `이번 주기 ${won(perf.sum)}원으로 최고 구간을 ${won(perf.overflow)}원 넘겼습니다. ` +
            `더 써도 추가 혜택이 없으니 다른 카드를 등록해 분산하세요.`,
        gain: alt ? alt.perf.nextGain : 0,
        need: 0,
        perDay: 0,
        reachable: false,
        altCardName: alt ? alt.card.name : null,
      });
      continue;
    }

    // 다음 구간 존재 → fill-need(도달 가능) 또는 ok(도달 어려움, 포기 권고)
    if (perf.next) {
      const need = perf.next.min - perf.sum;
      const perDay = Math.max(0, Math.ceil(need / left / 1000) * 1000);
      const dailyPace = perf.sum / elapsed;
      const reachable = perf.sum > 0 && dailyPace * left >= need * factor;
      const gainClause = perf.nextGain > 0 ? ` 달성 시 월 ${won(perf.nextGain)}원의 혜택이 늘어납니다.` : '';
      actions.push({
        type: reachable ? 'fill-need' : 'ok',
        cardId: card.id,
        cardName: card.name,
        issuer: card.issuer,
        altIssuer: null,
        title: `${card.name} — ${perf.next.label} 구간까지 ${won(need)}원`,
        body:
          `남은 ${left}일 동안 하루 ${won(perDay)}원씩 쓰면 도달합니다.` +
          (reachable
            ? ` 지금 속도면 달성 가능합니다.`
            : ` 지금 속도로는 빠듯합니다. 무리라면 이번 주기는 접고 다른 카드에 집중하세요.`) +
          gainClause,
        gain: reachable ? perf.nextGain : 0,
        need,
        perDay,
        reachable,
        altCardName: null,
      });
    }
  }

  // 초과 조치를 최상단으로, 그다음 예상 이득 내림차순
  actions.sort((a, b) => {
    const ao = a.type === 'over' ? 0 : 1;
    const bo = b.type === 'over' ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return b.gain - a.gain;
  });

  return { actions, rows, target };
}

export interface BestCard {
  card: Card;
  rate: number;
  monthlyCap: number | null;
}

/** 한 업종에서 최고 적립률 카드를 찾는다. 등록된 조건이 없으면 null. */
export function bestCardFor(category: CategoryName, cards: Card[]): BestCard | null {
  let best: BestCard | null = null;
  for (const c of cards.filter((c) => c.active !== false)) {
    const r = (c.rates || []).find((x) => x.category === category);
    if (r && (!best || r.rate > best.rate)) {
      best = { card: c, rate: r.rate, monthlyCap: r.monthlyCap };
    }
  }
  return best;
}
