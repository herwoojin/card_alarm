import { describe, it, expect } from 'vitest';
import { parseSMS, splitMessages } from '../index';
import type { CategoryName, IssuerKey } from '@/types';

/**
 * 골든 테스트 — 주요 8개 카드사 × 5개 형식 = 40건 이상 + 반려 10건.
 * 픽스처의 이름은 '홍*동', 카드번호는 임의 4자리로 마스킹(실제 개인정보 없음).
 * now를 고정해 날짜 파싱을 결정적으로 만든다.
 */
const NOW = new Date(2026, 6, 24, 12, 0); // 2026-07-24

interface Golden {
  name: string;
  raw: string;
  issuer: IssuerKey;
  amount: number;
  last4: string;
  merchant: string;
  category: CategoryName;
  installment: number;
  canceled: boolean;
  month: number; // 1-based
  day: number;
}

const GOLDEN: Golden[] = [
  // ── 신한 ────────────────────────────────────────────
  {
    name: '신한 · 다중행+누적',
    raw: '[Web발신]\n신한카드(1234)승인 홍*동\n12,000원 일시불\n07/24 14:23 스타벅스 강남점\n누적 742,300원',
    issuer: 'shinhan', amount: 12000, last4: '1234', merchant: '스타벅스 강남점', category: '카페', installment: 0, canceled: false, month: 7, day: 24,
  },
  {
    name: '신한 · 단일행 압축',
    raw: '신한카드 승인 8,900원 07/22 09:11 GS25 역삼점',
    issuer: 'shinhan', amount: 8900, last4: '', merchant: 'GS25 역삼점', category: '편의점', installment: 0, canceled: false, month: 7, day: 22,
  },
  {
    name: '신한 · 할부',
    raw: '[Web발신]\n신한카드(1234)승인 홍*동\n360,000원 3개월\n07/20 20:05 신세계백화점 강남',
    issuer: 'shinhan', amount: 360000, last4: '1234', merchant: '신세계백화점 강남', category: '백화점/아울렛', installment: 3, canceled: false, month: 7, day: 20,
  },
  {
    name: '신한 · 취소',
    raw: '[Web발신]\n신한카드(1234) 승인취소\n12,000원\n07/24 15:40 스타벅스 강남점',
    issuer: 'shinhan', amount: -12000, last4: '1234', merchant: '스타벅스 강남점', category: '카페', installment: 0, canceled: true, month: 7, day: 24,
  },
  {
    name: '신한 · 시각없음',
    raw: '신한카드(1234) 승인 23,400원 일시불 07/18 올리브영 강남',
    issuer: 'shinhan', amount: 23400, last4: '1234', merchant: '올리브영 강남', category: '생활/뷰티', installment: 0, canceled: false, month: 7, day: 18,
  },

  // ── KB국민 ──────────────────────────────────────────
  {
    name: 'KB · 다중행+누적',
    raw: '[Web발신]\nKB국민카드(5678)승인 홍*동\n45,600원 일시불\n07/23 19:10 이마트 성수점\n누적 512,000원',
    issuer: 'kb', amount: 45600, last4: '5678', merchant: '이마트 성수점', category: '마트/식료품', installment: 0, canceled: false, month: 7, day: 23,
  },
  {
    name: 'KB · 단일행',
    raw: '국민카드 승인 3,900원 07/21 08:02 CU 논현점',
    issuer: 'kb', amount: 3900, last4: '', merchant: 'CU 논현점', category: '편의점', installment: 0, canceled: false, month: 7, day: 21,
  },
  {
    name: 'KB · 할부',
    raw: '[Web발신]\nKB국민카드(5678)승인\n240,000원 6개월\n07/15 13:30 쿠팡',
    issuer: 'kb', amount: 240000, last4: '5678', merchant: '쿠팡', category: '온라인쇼핑', installment: 6, canceled: false, month: 7, day: 15,
  },
  {
    name: 'KB · 취소',
    raw: 'KB국민카드(5678) 취소 45,600원 07/23 20:00 이마트 성수점',
    issuer: 'kb', amount: -45600, last4: '5678', merchant: '이마트 성수점', category: '마트/식료품', installment: 0, canceled: true, month: 7, day: 23,
  },
  {
    name: 'KB · 시각없음',
    raw: 'KB카드 승인 17,000원 일시불 07/14 넷플릭스',
    issuer: 'kb', amount: 17000, last4: '', merchant: '넷플릭스', category: '문화/구독', installment: 0, canceled: false, month: 7, day: 14,
  },

  // ── 삼성 ────────────────────────────────────────────
  {
    name: '삼성 · 다중행+누적',
    raw: '[Web발신]\n삼성카드(2468) 승인\n6,800원 일시불\n07/24 07:45 메가커피 삼성점\n누적 231,500원',
    issuer: 'samsung', amount: 6800, last4: '2468', merchant: '메가커피 삼성점', category: '카페', installment: 0, canceled: false, month: 7, day: 24,
  },
  {
    name: '삼성 · 단일행',
    raw: '삼성카드 승인 128,000원 07/19 15:22 11번가',
    issuer: 'samsung', amount: 128000, last4: '', merchant: '11번가', category: '온라인쇼핑', installment: 0, canceled: false, month: 7, day: 19,
  },
  {
    name: '삼성 · 할부',
    raw: '[Web발신]\n삼성카드(2468) 승인\n540,000원 12개월\n07/10 11:00 현대아울렛 김포',
    issuer: 'samsung', amount: 540000, last4: '2468', merchant: '현대아울렛 김포', category: '백화점/아울렛', installment: 12, canceled: false, month: 7, day: 10,
  },
  {
    name: '삼성 · 취소',
    raw: '삼성카드(2468) 매입취소 6,800원 07/24 08:00 메가커피 삼성점',
    issuer: 'samsung', amount: -6800, last4: '2468', merchant: '메가커피 삼성점', category: '카페', installment: 0, canceled: true, month: 7, day: 24,
  },
  {
    name: '삼성 · 시각없음',
    raw: '삼성카드(2468) 승인 52,400원 일시불 07/12 SRT 승차권',
    issuer: 'samsung', amount: 52400, last4: '2468', merchant: 'SRT 승차권', category: '교통', installment: 0, canceled: false, month: 7, day: 12,
  },

  // ── 현대 ────────────────────────────────────────────
  {
    name: '현대 · 다중행+누적',
    raw: '[Web발신]\n현대카드(9012) 승인 홍*동\n82,000원 일시불\n07/22 18:30 GS칼텍스 주유소\n누적 458,000원',
    issuer: 'hyundai', amount: 82000, last4: '9012', merchant: 'GS칼텍스 주유소', category: '주유/충전', installment: 0, canceled: false, month: 7, day: 22,
  },
  {
    name: '현대 · 단일행',
    raw: '현대카드 승인 68,000원 07/20 10:15 현대오일뱅크',
    issuer: 'hyundai', amount: 68000, last4: '', merchant: '현대오일뱅크', category: '주유/충전', installment: 0, canceled: false, month: 7, day: 20,
  },
  {
    name: '현대 · 할부',
    raw: '[Web발신]\n현대카드(9012) 승인\n1,200,000원 10개월\n07/08 16:40 코스트코 양평',
    issuer: 'hyundai', amount: 1200000, last4: '9012', merchant: '코스트코 양평', category: '마트/식료품', installment: 10, canceled: false, month: 7, day: 8,
  },
  {
    name: '현대 · 취소',
    raw: '현대카드(9012) 취소 82,000원 07/22 19:00 GS칼텍스 주유소',
    issuer: 'hyundai', amount: -82000, last4: '9012', merchant: 'GS칼텍스 주유소', category: '주유/충전', installment: 0, canceled: true, month: 7, day: 22,
  },
  {
    name: '현대 · 시각없음',
    raw: '현대카드(9012) 승인 210,000원 일시불 07/06 신세계백화점',
    issuer: 'hyundai', amount: 210000, last4: '9012', merchant: '신세계백화점', category: '백화점/아울렛', installment: 0, canceled: false, month: 7, day: 6,
  },

  // ── 롯데 ────────────────────────────────────────────
  {
    name: '롯데 · 다중행+누적',
    raw: '[Web발신]\n롯데카드(3456) 승인\n27,000원 일시불\n07/23 12:30 배달의민족\n누적 189,000원',
    issuer: 'lotte', amount: 27000, last4: '3456', merchant: '배달의민족', category: '음식점', installment: 0, canceled: false, month: 7, day: 23,
  },
  {
    name: '롯데 · 단일행',
    raw: '롯데카드 승인 9,500원 07/21 21:40 요기요',
    issuer: 'lotte', amount: 9500, last4: '', merchant: '요기요', category: '음식점', installment: 0, canceled: false, month: 7, day: 21,
  },
  {
    name: '롯데 · 할부',
    raw: '[Web발신]\n롯데카드(3456) 승인\n360,000원 3개월\n07/16 14:00 롯데마트 잠실',
    issuer: 'lotte', amount: 360000, last4: '3456', merchant: '롯데마트 잠실', category: '마트/식료품', installment: 3, canceled: false, month: 7, day: 16,
  },
  {
    name: '롯데 · 취소',
    raw: '롯데카드(3456) 승인취소 27,000원 07/23 13:00 배달의민족',
    issuer: 'lotte', amount: -27000, last4: '3456', merchant: '배달의민족', category: '음식점', installment: 0, canceled: true, month: 7, day: 23,
  },
  {
    name: '롯데 · 시각없음',
    raw: '롯데카드(3456) 승인 48,000원 일시불 07/11 병원 진료비',
    issuer: 'lotte', amount: 48000, last4: '3456', merchant: '병원 진료비', category: '의료/약국', installment: 0, canceled: false, month: 7, day: 11,
  },

  // ── 우리 ────────────────────────────────────────────
  {
    name: '우리 · 다중행+누적',
    raw: '[Web발신]\n우리카드(7788) 승인 홍*동\n34,500원 일시불\n07/24 11:20 올리브영 신촌\n누적 267,800원',
    issuer: 'woori', amount: 34500, last4: '7788', merchant: '올리브영 신촌', category: '생활/뷰티', installment: 0, canceled: false, month: 7, day: 24,
  },
  {
    name: '우리 · 단일행',
    raw: '우리카드 승인 12,400원 07/22 08:50 카카오T 택시',
    issuer: 'woori', amount: 12400, last4: '', merchant: '카카오T 택시', category: '교통', installment: 0, canceled: false, month: 7, day: 22,
  },
  {
    name: '우리 · 할부',
    raw: '[Web발신]\n우리카드(7788) 승인\n180,000원 5개월\n07/13 17:10 무신사',
    issuer: 'woori', amount: 180000, last4: '7788', merchant: '무신사', category: '온라인쇼핑', installment: 5, canceled: false, month: 7, day: 13,
  },
  {
    name: '우리 · 취소',
    raw: '우리카드(7788) 취소 34,500원 07/24 12:00 올리브영 신촌',
    issuer: 'woori', amount: -34500, last4: '7788', merchant: '올리브영 신촌', category: '생활/뷰티', installment: 0, canceled: true, month: 7, day: 24,
  },
  {
    name: '우리 · 시각없음',
    raw: '우리카드(7788) 승인 28,000원 일시불 07/09 CGV 강남',
    issuer: 'woori', amount: 28000, last4: '7788', merchant: 'CGV 강남', category: '문화/구독', installment: 0, canceled: false, month: 7, day: 9,
  },

  // ── 하나 ────────────────────────────────────────────
  {
    name: '하나 · 다중행+누적',
    raw: '[Web발신]\n하나카드(1357) 승인\n73,200원 일시불\n07/21 16:05 홈플러스 영등포\n누적 401,000원',
    issuer: 'hana', amount: 73200, last4: '1357', merchant: '홈플러스 영등포', category: '마트/식료품', installment: 0, canceled: false, month: 7, day: 21,
  },
  {
    name: '하나 · 단일행',
    raw: '하나카드 승인 4,300원 07/20 07:30 세븐일레븐 역삼',
    issuer: 'hana', amount: 4300, last4: '', merchant: '세븐일레븐 역삼', category: '편의점', installment: 0, canceled: false, month: 7, day: 20,
  },
  {
    name: '하나 · 할부',
    raw: '[Web발신]\n하나카드(1357) 승인\n96,000원 4개월\n07/17 19:45 G마켓',
    issuer: 'hana', amount: 96000, last4: '1357', merchant: 'G마켓', category: '온라인쇼핑', installment: 4, canceled: false, month: 7, day: 17,
  },
  {
    name: '하나 · 취소',
    raw: '하나카드(1357) 매입취소 73,200원 07/21 17:00 홈플러스 영등포',
    issuer: 'hana', amount: -73200, last4: '1357', merchant: '홈플러스 영등포', category: '마트/식료품', installment: 0, canceled: true, month: 7, day: 21,
  },
  {
    name: '하나 · 시각없음',
    raw: '하나카드(1357) 승인 68,000원 일시불 07/05 한국전력 전기요금',
    issuer: 'hana', amount: 68000, last4: '1357', merchant: '한국전력 전기요금', category: '공과금/세금', installment: 0, canceled: false, month: 7, day: 5,
  },

  // ── NH농협 ──────────────────────────────────────────
  {
    name: 'NH · 다중행+누적',
    raw: '[Web발신]\nNH농협카드(2244) 승인 홍*동\n52,400원 일시불\n07/22 09:30 코레일 승차권\n누적 318,000원',
    issuer: 'nh', amount: 52400, last4: '2244', merchant: '코레일 승차권', category: '교통', installment: 0, canceled: false, month: 7, day: 22,
  },
  {
    name: 'NH · 단일행',
    raw: '농협카드 승인 2,500원 07/24 10:05 메가커피',
    issuer: 'nh', amount: 2500, last4: '', merchant: '메가커피', category: '카페', installment: 0, canceled: false, month: 7, day: 24,
  },
  {
    name: 'NH · 할부',
    raw: '[Web발신]\nNH농협카드(2244) 승인\n300,000원 3개월\n07/12 13:15 하나로마트 양재',
    issuer: 'nh', amount: 300000, last4: '2244', merchant: '하나로마트 양재', category: '마트/식료품', installment: 3, canceled: false, month: 7, day: 12,
  },
  {
    name: 'NH · 취소',
    raw: 'NH농협카드(2244) 취소 52,400원 07/22 10:00 코레일 승차권',
    issuer: 'nh', amount: -52400, last4: '2244', merchant: '코레일 승차권', category: '교통', installment: 0, canceled: true, month: 7, day: 22,
  },
  {
    name: 'NH · 시각없음',
    raw: 'NH농협카드(2244) 승인 158,000원 일시불 07/04 쿠팡',
    issuer: 'nh', amount: 158000, last4: '2244', merchant: '쿠팡', category: '온라인쇼핑', installment: 0, canceled: false, month: 7, day: 4,
  },
];

describe('parseSMS — 골든 케이스 (8개사 × 5형식)', () => {
  it.each(GOLDEN)('$name', (g) => {
    const r = parseSMS(g.raw, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.txn;
    expect(t.issuer).toBe(g.issuer);
    expect(t.amount).toBe(g.amount);
    expect(t.last4).toBe(g.last4);
    expect(t.merchant).toBe(g.merchant);
    expect(t.category).toBe(g.category);
    expect(t.installment).toBe(g.installment);
    expect(t.canceled).toBe(g.canceled);
    const d = new Date(t.date);
    expect(d.getMonth() + 1).toBe(g.month);
    expect(d.getDate()).toBe(g.day);
  });

  it('40건 이상을 커버한다', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(40);
  });

  it('누적금액을 결제금액으로 오인식하지 않는다', () => {
    const r = parseSMS('[Web발신]\n신한카드(1234)승인\n12,000원 일시불\n07/24 스타벅스\n누적 742,300원', NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.txn.amount).toBe(12000);
      expect(r.txn.cumulative).toBe(742300);
    }
  });
});

describe('parseSMS — 반려 케이스', () => {
  const REJECT: { name: string; raw: string; reason: string }[] = [
    { name: '청구금액 안내', raw: '[Web발신]\n고객님 이번 달 청구금액 안내\n총 1,284,000원\n앱에서 확인하세요', reason: '결제 문자가 아닌 안내 문자입니다' },
    { name: '명세서 안내', raw: '[Web발신]\n7월 이용대금 명세서가 발행되었습니다. 총 850,000원', reason: '결제 문자가 아닌 안내 문자입니다' },
    { name: '이벤트 광고', raw: '[Web발신]\n[광고] 신한카드 여름 이벤트! 최대 5만원 캐시백 45,000원 혜택', reason: '결제 문자가 아닌 안내 문자입니다' },
    { name: '한도 상향 안내', raw: '[Web발신]\nKB국민카드 이용한도 상향 안내 500,000원 가능', reason: '결제 문자가 아닌 안내 문자입니다' },
    { name: '무이자 행사', raw: '[Web발신]\n삼성카드 무이자 행사 안내 2~6개월 무이자 300,000원 이상', reason: '결제 문자가 아닌 안내 문자입니다' },
    { name: '빈 문자열', raw: '', reason: '내용이 너무 짧습니다' },
    { name: '너무 짧은 문자', raw: '안녕', reason: '내용이 너무 짧습니다' },
    { name: '카드사명 없음', raw: '승인 12,000원 07/24 14:00 스타벅스 강남점', reason: '카드사를 찾지 못했습니다' },
    { name: '금액 없는 문자', raw: '신한카드 승인 완료되었습니다 감사합니다', reason: '결제 금액을 찾지 못했습니다' },
    { name: '전부 누적금액', raw: '국민카드 누적 500,000원 이번달 사용분입니다', reason: '결제 금액을 찾지 못했습니다' },
  ];

  it.each(REJECT)('$name → $reason', (c) => {
    const r = parseSMS(c.raw, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(c.reason);
  });
});

describe('splitMessages', () => {
  it('빈 줄로 5건을 5건으로 분리한다', () => {
    const five = Array.from({ length: 5 }, (_, i) => `[Web발신]\n신한카드(1234)승인\n${(i + 1) * 1000}원 일시불\n07/2${i} 스타벅스`).join('\n\n');
    expect(splitMessages(five)).toHaveLength(5);
  });

  it('한 블록에 [Web발신]이 여러 번이면 재분리한다', () => {
    const glued = '[Web발신]\n신한카드(1234)승인\n1,000원\n07/24 A\n[Web발신]\n삼성카드(2468)승인\n2,000원\n07/24 B\n[Web발신]\nKB국민카드(5678)승인\n3,000원\n07/24 C';
    expect(splitMessages(glued).length).toBeGreaterThanOrEqual(3);
  });
});

describe('parseSMS — 성능', () => {
  it('1건 파싱이 5ms 이내', () => {
    const raw = GOLDEN[0].raw;
    const t0 = performance.now();
    parseSMS(raw, NOW);
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(5);
  });

  it('순수 함수 — 같은 입력에 같은 필드(id 제외)', () => {
    const a = parseSMS(GOLDEN[0].raw, NOW);
    const b = parseSMS(GOLDEN[0].raw, NOW);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.txn.amount).toBe(b.txn.amount);
      expect(a.txn.merchant).toBe(b.txn.merchant);
      expect(a.txn.date).toBe(b.txn.date);
    }
  });
});
