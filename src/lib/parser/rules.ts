import type { IssuerRule } from '@/types';

/**
 * 카드사 사전 13종 (ERD 3.1).
 *
 * 배열의 순서가 곧 매칭 우선순위다. 위에서부터 정규식을 시험해 첫 매칭이 이긴다.
 * - '국민카드 | KB국민 | KB카드'는 kb로 잡힌다.
 * - '농협 | NH'는 nh로 잡힌다.
 * - 'etc'(기타)는 최후 폴백이므로 반드시 마지막에 둔다.
 *
 * 데이터만 고치면 동작이 바뀌도록, 여기서는 규칙 데이터만 정의한다.
 */
export const ISSUERS: readonly IssuerRule[] = [
  { key: 'shinhan', name: '신한카드', regex: /신한/ },
  { key: 'kb', name: 'KB국민카드', regex: /국민카드|KB국민|KB카드|KB국민카드/i },
  { key: 'samsung', name: '삼성카드', regex: /삼성/ },
  { key: 'hyundai', name: '현대카드', regex: /현대/ },
  { key: 'lotte', name: '롯데카드', regex: /롯데/ },
  { key: 'woori', name: '우리카드', regex: /우리/ },
  { key: 'hana', name: '하나카드', regex: /하나/ },
  { key: 'nh', name: 'NH농협카드', regex: /농협|NH/i },
  { key: 'bc', name: 'BC카드', regex: /\bBC\b|비씨/i },
  { key: 'ibk', name: 'IBK기업', regex: /기업은행|IBK/i },
  { key: 'kakao', name: '카카오뱅크', regex: /카카오뱅크|카뱅/ },
  { key: 'toss', name: '토스뱅크', regex: /토스/ },
  { key: 'etc', name: '기타', regex: /카드/ },
] as const;

/**
 * 정규화된 문자열에서 카드사를 식별한다. 매칭 실패 시 null.
 *
 * 카드사명은 문자의 맨 앞(카드 이름 부분)에 나타난다. 따라서 매칭 "위치"가 가장 앞선
 * 규칙을 고른다. 이렇게 하면 가맹점명에 다른 카드사 키워드가 섞여 있어도
 * (예: NH농협 문자의 '하나로마트') 오분류하지 않는다.
 * 같은 위치에서 겹치면 배열 순서(우선순위)로 가른다.
 */
export function findIssuer(flat: string): IssuerRule | null {
  let best: IssuerRule | null = null;
  let bestIndex = Number.POSITIVE_INFINITY;
  // 배열 순서대로 돌며 '더 앞선 위치'에서만 교체한다.
  // 같은 위치면 먼저 순회한(=우선순위 높은) 규칙이 유지된다.
  for (const rule of ISSUERS) {
    const m = rule.regex.exec(flat);
    if (!m) continue;
    if (m.index < bestIndex) {
      bestIndex = m.index;
      best = rule;
    }
  }
  return best;
}
