import type { ParseResult, Transaction } from '@/types';
import { uid } from '@/lib/id';
import { findIssuer } from './rules';
import { classify } from './categories';

/**
 * 결제 문자 1건을 파싱한다. **순수 함수** — DB 접근·부수효과 없음.
 * TRD 4.2절의 10단계 파이프라인을 따른다.
 *
 * @param raw 원본 문자 1건
 * @param now 기준 시각(테스트 결정성). 생략 시 현재 시각
 */
export function parseSMS(raw: string, now: Date = new Date()): ParseResult {
  const src = String(raw ?? '');

  // ① 정규화 — [Web발신] 등 접두 제거, \r 제거. 개행은 보존
  const t = src.replace(/\[(Web발신|국외발신|국제발신|광고)\]/g, '').replace(/\r/g, '');
  const flat = t.replace(/\s+/g, ' ').trim();
  if (flat.length < 6) return { ok: false, reason: '내용이 너무 짧습니다', raw: src };

  const isCancel = /(취소|승인취소|매입취소)/.test(flat);
  const isApprove = /(승인|결제|사용)/.test(flat);

  // ② 안내 문자 판별 — 청구·명세서·이벤트 키워드 + 승인 키워드 부재 시 조기 반려
  const isNotice = /(청구금액|명세서|안내드립|이벤트|무이자\s*행사|광고|한도\s*상향|연체)/.test(flat);
  if (isNotice && !isApprove) return { ok: false, reason: '결제 문자가 아닌 안내 문자입니다', raw: src };

  // ③ 카드사 식별
  const iss = findIssuer(flat);
  if (!iss) return { ok: false, reason: '카드사를 찾지 못했습니다', raw: src };

  // ④ 금액 추출 — 누적/잔여/한도/포인트 등 선행어가 붙은 숫자는 결제금액 후보에서 제외
  const skipBefore = /(누적|누계|잔액|잔여|한도|포인트|합계|총|적립|월)\s*[^0-9]{0,4}$/;
  const amountRe = /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,9})\s*원/g;
  let amount: number | null = null;
  let cumulative: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = amountRe.exec(flat)) !== null) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    const before = flat.slice(Math.max(0, m.index - 10), m.index);
    if (skipBefore.test(before)) {
      // 누적금액도 버리지 않고 대조 검증용으로 보관한다
      if (cumulative === null) cumulative = val;
      continue;
    }
    if (amount === null) amount = val;
  }
  if (amount === null) return { ok: false, reason: '결제 금액을 찾지 못했습니다', raw: src };

  // ⑤ 뒷자리 추출 — (1234) 또는 카드1234
  const l4m = flat.match(/[(\[]?(\d{4})[)\]]/) ?? flat.match(/카드\s*(\d{4})/);
  const last4 = l4m ? l4m[1] : '';

  // ⑥ 일시 추출 — MM/DD + HH:MM. 미래 월(현재 월+2 초과)이면 전년도 보정
  const dm = flat.match(/(\d{1,2})\s*[/.월]\s*(\d{1,2})/);
  const tm = flat.match(/(\d{1,2}):(\d{2})/);
  let year = now.getFullYear();
  let mo = now.getMonth() + 1;
  let da = now.getDate();
  if (dm) {
    mo = +dm[1];
    da = +dm[2];
    if (mo > now.getMonth() + 2) year -= 1;
  }
  const hh = tm ? +tm[1] : 12;
  const mi = tm ? +tm[2] : 0;
  const date = new Date(year, mo - 1, da, hh, mi);
  if (Number.isNaN(date.getTime())) return { ok: false, reason: '날짜를 읽지 못했습니다', raw: src };

  // ⑦ 할부 추출
  const instMatch = flat.match(/(\d{1,2})\s*개월/);
  const installment = instMatch ? +instMatch[1] : 0;

  // ⑧ 가맹점 추출 — 3단 폴백. 먼저 누적/이용금액 노이즈를 제거
  const cleaned = flat
    .replace(/(누적|누계|잔액|잔여|한도|포인트|적립|합계)[^0-9]{0,6}[0-9,]+\s*원?/g, '')
    .replace(/(총승인금액|이용금액|결제예정)/g, '');
  const patterns = [
    /(?:일시불|\d{1,2}개월)\s*(?:\d{1,2}[/.]\d{1,2})?\s*(?:\d{1,2}:\d{2})?\s*(.+)$/,
    /\d{1,2}:\d{2}\s*(.+)$/,
    /\d{1,2}[/.]\d{1,2}\s*(.+)$/,
  ];
  let merchant = '';
  for (const p of patterns) {
    const r = cleaned.match(p);
    if (r && r[1] && r[1].trim().length > 1) {
      merchant = r[1];
      break;
    }
  }
  merchant = merchant
    .replace(/(승인|취소|일시불|완료|정상|님)/g, '')
    .replace(/[0-9,]+원/g, '')
    .replace(/^[\s\-·,.]+|[\s\-·,.]+$/g, '')
    .trim();
  if (merchant.length > 26) merchant = merchant.slice(0, 26);

  // 2자 미만이면 needsReview. 거래는 살린다 — 금액과 카드사만 맞으면 실적 계산은 가능하다
  const needsReview = merchant.length < 2;
  if (needsReview) merchant = '가맹점 미상';

  // ⑨ 업종 분류
  const category = classify(merchant);

  // ⑩ 취소 판정 — 취소 키워드 시 금액 음수화
  const signedAmount = isCancel ? -Math.abs(amount) : amount;

  const txn: Transaction = {
    id: uid(),
    cardId: null,
    issuer: iss.key,
    issuerName: iss.name,
    last4,
    amount: signedAmount,
    date: date.toISOString(),
    merchant,
    category,
    installment,
    canceled: isCancel,
    cumulative,
    excludedManual: null,
    raw: src,
    source: 'sms',
    needsReview,
    createdAt: new Date(now.getTime()).toISOString(),
  };

  return { ok: true, txn, needsReview };
}

/**
 * 여러 건이 붙은 텍스트를 개별 문자 블록으로 분리한다.
 * 빈 줄로 블록을 나누고, 한 블록에 [Web발신]이 여러 번 나오면 다시 쪼갠다.
 */
export function splitMessages(text: string): string[] {
  const blocks = String(text)
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const b of blocks) {
    if (b.split('\n').length <= 6) {
      out.push(b);
      continue;
    }
    const lines = b.split('\n');
    let cur: string[] = [];
    for (const ln of lines) {
      if (/\[Web발신\]/.test(ln) && cur.length) {
        out.push(cur.join('\n'));
        cur = [ln];
      } else {
        cur.push(ln);
      }
    }
    if (cur.length) out.push(cur.join('\n'));
  }
  return out;
}

export { findIssuer, ISSUERS } from './rules';
export { classify, CATEGORIES, CATEGORY_NAMES, CATEGORY_ICON, DEFAULT_EXCLUDE } from './categories';
