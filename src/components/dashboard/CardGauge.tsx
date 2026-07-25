'use client';

import { useEffect, useState } from 'react';
import type { Card } from '@/types';
import type { Performance } from '@/lib/domain/performance';
import { won } from '@/lib/format';
import { Money } from '@/components/ui/Money';

interface CardGaugeProps {
  card: Card;
  perf: Performance;
  onEdit: () => void;
}

/**
 * 시그니처 UI — 카드가 곧 게이지다.
 * 플라스틱 카드 모양 안에서 실적이 왼쪽부터 차오르고, 실적 구간이 세로 눈금으로 새겨진다.
 * Card와 Performance를 받아 표시만 한다 (내부에서 계산하지 않는다).
 *
 * 상태 3종:
 *  - 미달: 차오름 --hl-soft, 배지=현재 구간 또는 '미달'
 *  - 달성: 차오름 --go-soft, 배지 '달성'(--go)
 *  - 초과: 차오름 --warn-soft, 배지 '초과'(--warn)
 */
export function CardGauge({ card, perf, onEdit }: CardGaugeProps) {
  // 진입 시 0에서 시작해 차오른다
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(perf.progress));
    return () => cancelAnimationFrame(id);
  }, [perf.progress]);

  const isOver = perf.overflow > 0;
  const isDone = !isOver && !perf.next && !!perf.top;
  const stateClass = isOver ? 'over' : isDone ? 'done' : '';

  const cap = perf.top ? perf.top.min : Math.max(perf.sum, 1);

  const badge = isOver ? (
    <span className="badge b-warn">초과</span>
  ) : isDone ? (
    <span className="badge b-go">달성</span>
  ) : perf.cur ? (
    <span className="badge b-hl">{perf.cur.label}</span>
  ) : (
    <span className="badge b-idle">미달</span>
  );

  const message = isOver ? (
    <>
      최고 구간을 <b><Money value={perf.overflow} /></b> 넘겼습니다
    </>
  ) : perf.next ? (
    <>
      {perf.next.label} 구간까지 <b><Money value={perf.next.min - perf.sum} /></b>
    </>
  ) : perf.top ? (
    <>모든 구간 달성</>
  ) : (
    <>실적 구간이 없는 카드</>
  );

  return (
    <button type="button" className={`pcard ${stateClass}`} onClick={onEdit} aria-label={`${card.name} 실적 ${won(perf.sum)}원, 눌러서 편집`}>
      <span className="fill" style={{ width: `${w}%` }} aria-hidden="true" />
      {perf.tiers.map((t, i) => {
        const x = Math.min(100, (t.min / cap) * 100);
        return (
          <span className="tick" style={{ left: `${x}%` }} key={i} aria-hidden="true">
            <i>{t.label}</i>
          </span>
        );
      })}
      <span className="body">
        <span className="row1">
          <span className="nm">{card.name}</span>
          <span className="l4">{card.last4 ? '···' + card.last4 : ''}</span>
          {badge}
        </span>
        <span className="amt num" style={{ display: 'block' }}>
          {won(perf.sum)}
          <span>원</span>
        </span>
        <span className="msg" style={{ display: 'block' }}>
          {message}
          {perf.excluded > 0 ? <> · 실적 제외 {won(perf.excluded)}원</> : null}
        </span>
      </span>
    </button>
  );
}

/*
 * 목 데이터 3상태 예시 (Storybook 없이 확인용):
 *
 * 미달: perf = { sum: 380000, next: {label:'50만', min:500000}, cur:{label:'30만',...}, top:{min:1000000}, progress:38, overflow:0, ... }
 *   → 배지 '30만', 차오름 38% (hl-soft), "50만 구간까지 120,000원"
 * 달성: perf = { sum: 1020000, next: null, cur:{...}, top:{min:1000000}, progress:100, overflow:20000, ... }
 *   → overflow>0 이므로 초과 상태로 전환됨
 * 달성(정확): perf = { sum: 1000000, next: null, top:{min:1000000}, progress:100, overflow:0 }
 *   → 배지 '달성', 차오름 100% (go-soft), "모든 구간 달성"
 * 초과: perf = { sum: 1180000, next: null, top:{min:1000000}, progress:100, overflow:180000 }
 *   → 배지 '초과', 차오름 100% (warn-soft), "최고 구간을 180,000원 넘겼습니다"
 */
