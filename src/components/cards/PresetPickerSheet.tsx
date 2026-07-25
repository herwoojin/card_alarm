'use client';

import type { CategoryName, IssuerKey } from '@/types';
import { DEFAULT_EXCLUDE } from '@/lib/parser/categories';
import { won } from '@/lib/format';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';

interface Preset {
  name: string;
  issuer: IssuerKey;
  annualFee: number;
  tiers: { label: string; min: number; benefit: number }[];
  rates: { category: CategoryName; rate: number }[];
}

/** 흔한 구간 형태 5종. 숫자는 형태를 보여주는 예시이며 실제 값은 사용자가 고쳐야 한다. */
const PRESETS: Preset[] = [
  {
    name: '3구간형 (30/50/100만)', issuer: 'shinhan', annualFee: 15000,
    tiers: [{ label: '30만', min: 300000, benefit: 10000 }, { label: '50만', min: 500000, benefit: 20000 }, { label: '100만', min: 1000000, benefit: 40000 }],
    rates: [{ category: '편의점', rate: 5 }, { category: '카페', rate: 5 }, { category: '교통', rate: 3 }],
  },
  {
    name: '2구간형 (40/70만)', issuer: 'kb', annualFee: 12000,
    tiers: [{ label: '40만', min: 400000, benefit: 15000 }, { label: '70만', min: 700000, benefit: 30000 }],
    rates: [{ category: '마트/식료품', rate: 5 }, { category: '온라인쇼핑', rate: 3 }],
  },
  {
    name: '단일 구간형 (30만)', issuer: 'samsung', annualFee: 10000,
    tiers: [{ label: '30만', min: 300000, benefit: 12000 }],
    rates: [{ category: '온라인쇼핑', rate: 5 }, { category: '문화/구독', rate: 10 }],
  },
  {
    name: '고액 구간형 (50/100/200만)', issuer: 'hyundai', annualFee: 30000,
    tiers: [{ label: '50만', min: 500000, benefit: 15000 }, { label: '100만', min: 1000000, benefit: 40000 }, { label: '200만', min: 2000000, benefit: 90000 }],
    rates: [{ category: '주유/충전', rate: 5 }, { category: '백화점/아울렛', rate: 3 }],
  },
  {
    name: '무실적형 (구간 없음)', issuer: 'toss', annualFee: 0,
    tiers: [],
    rates: [{ category: '편의점', rate: 3 }, { category: '교통', rate: 3 }],
  },
];

export function PresetPickerSheet() {
  const saveCard = useAppStore((s) => s.saveCard);
  const ui = useUI();

  const use = async (p: Preset) => {
    await saveCard({
      issuer: p.issuer,
      name: p.name,
      last4: '',
      annualFee: p.annualFee,
      tiers: p.tiers,
      excludes: [...DEFAULT_EXCLUDE],
      rates: p.rates.map((r) => ({ ...r, monthlyCap: null })),
    });
    ui.closeSheet();
    ui.go('cards');
    ui.toast('추가했습니다. 카드 이름과 뒷자리를 채워주세요');
  };

  return (
    <>
      <h3>템플릿에서 고르기</h3>
      <p className="sh-sub">비슷한 형태를 고른 뒤, 카드사 공지의 실제 값으로 고쳐 쓰세요.</p>
      {PRESETS.map((p, i) => (
        <button type="button" className="box" style={{ marginBottom: 9, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }} key={i} onClick={() => use(p)}>
          <b style={{ fontSize: 14 }}>{p.name}</b>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 5 }}>
            {p.tiers.length ? p.tiers.map((t) => `${t.label} → ${won(t.benefit)}원`).join(' / ') : '실적 조건 없음'}
          </div>
        </button>
      ))}
      <p className="note">
        여기 적힌 구간과 혜택 금액은 형태를 보여주기 위한 예시입니다. 실제 조건은 카드사 홈페이지·앱의 상품 안내를 확인해 입력해야 합니다.
      </p>
    </>
  );
}
