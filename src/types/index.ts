/**
 * 실적ON — 전역 타입 정의
 * 근거: ERD.md 2·3절. 모든 금액은 원 단위 정수(number)로 다룬다.
 *
 * 금지: 카드번호 전체, 유효기간, CVC, 비밀번호, 명의자 주민번호.
 * 이런 필드는 어떤 이름으로도 이 파일에 존재하지 않는다. (ERD 2.1 제약)
 */

/** 카드사 키 — 상수 사전 13종 (ERD 3.1). 매칭 순서가 곧 우선순위이며 'etc'가 최후. */
export type IssuerKey =
  | 'shinhan'
  | 'kb'
  | 'samsung'
  | 'hyundai'
  | 'lotte'
  | 'woori'
  | 'hana'
  | 'nh'
  | 'bc'
  | 'ibk'
  | 'kakao'
  | 'toss'
  | 'etc';

/** 업종명 — 상수 사전 15종 (ERD 3.2). 좁은 범위가 넓은 범위보다 앞선다. */
export type CategoryName =
  | '편의점'
  | '카페'
  | '음식점'
  | '마트/식료품'
  | '온라인쇼핑'
  | '교통'
  | '주유/충전'
  | '통신'
  | '의료/약국'
  | '문화/구독'
  | '백화점/아울렛'
  | '생활/뷰티'
  | '보험/금융'
  | '공과금/세금'
  | '상품권/충전'
  | '기타';

/** 실적 구간 (Card에 내장). min 오름차순 정렬 유지. */
export interface Tier {
  /** 표시용 라벨. 예: "30만" */
  label: string;
  /** 이 구간이 열리는 실적 기준액(원, 정수) */
  min: number;
  /** 이 구간 달성 시 월 예상 혜택(원, 정수). 사용자 입력값 */
  benefit: number;
}

/** 업종별 적립 조건 (Card에 내장). */
export interface CategoryRate {
  /** 업종명. Category 사전의 값 */
  category: CategoryName;
  /** 적립·할인율(%) */
  rate: number;
  /** 월 한도(원, 정수). null이면 무제한 (v1.1에서 계산 반영) */
  monthlyCap: number | null;
}

/** 할부 실적 반영 정책 (v1.1에서 분할 옵션 사용). */
export type InstallmentPolicy = 'full' | 'split';

/** 보유 카드와 그 조건. 사용자가 직접 입력·관리한다. (ERD 2.1) */
export interface Card {
  id: string;
  issuer: IssuerKey;
  /** 사용자 지정 카드 이름 */
  name: string;
  /** 카드 뒷 4자리. 전체 카드번호는 저장하지 않는다. 숫자 4자리 또는 '' */
  last4: string;
  /** 연회비(원, 정수). 연간 전망에서 차감 */
  annualFee: number;
  /** 실적 구간 배열. min 오름차순 정렬 유지. 빈 배열이면 무실적 카드 */
  tiers: Tier[];
  /** 실적 제외 업종명 배열. 기본값은 DEFAULT_EXCLUDE 3종 */
  excludes: CategoryName[];
  /** 업종별 적립 조건 */
  rates: CategoryRate[];
  /** 카드별 주기 시작일(1–31). null이면 전역 설정 사용 (v1.1) */
  cycleStartDay: number | null;
  /** 할부 실적 반영 정책 (v1.1) */
  installmentPolicy: InstallmentPolicy;
  /** false면 계산·추천에서 제외. 삭제 대신 비활성 권장 */
  active: boolean;
  createdAt: string;
  /** 6개월 이상 미수정 시 조건 재확인 안내 트리거 */
  updatedAt: string;
}

/** 거래 수집 경로. */
export type TxnSource = 'sms' | 'share' | 'clipboard' | 'manual';

/** 결제 1건. 문자 파싱 또는 직접 입력으로 생성된다. (ERD 2.2) */
export interface Transaction {
  id: string;
  /** cards.id 참조. NULL 허용(카드 미지정). 계산에서 제외됨 */
  cardId: string | null;
  /** 파싱 시점의 카드사. cardId가 없어도 남는다 */
  issuer: IssuerKey;
  /** 표시용 카드사명 */
  issuerName: string;
  /** 파싱된 뒷자리. 카드 매칭 키. 없으면 '' */
  last4: string;
  /** 결제 금액(원, 정수). 취소 거래는 음수. 0일 수 없다 */
  amount: number;
  /** 승인 일시 (ISO string) */
  date: string;
  /** 가맹점명. 추출 실패 시 '가맹점 미상' */
  merchant: string;
  /** 업종. 자동 분류 후 사용자 수정 가능 */
  category: CategoryName;
  /** 할부 개월. 0이면 일시불 */
  installment: number;
  /** 취소 거래 여부. true이면 amount < 0 */
  canceled: boolean;
  /** 문자에 적힌 누적금액. 대조 검증용. 없으면 null */
  cumulative: number | null;
  /**
   * 실적 반영 수동 지정 — 3상태.
   * - null:  업종 규칙에 맡긴다 (기본)
   * - false: 업종상 제외 대상이지만 실적에 **포함**하라고 사용자가 지정
   * - true:  업종상 포함 대상이지만 실적에서 **제외**하라고 사용자가 지정
   */
  excludedManual: boolean | null;
  /** 원본 문자. rawRetentionMonths 경과 후 빈 문자열로 대체 */
  raw: string;
  source: TxnSource;
  /** 가맹점 추출 실패 등 확인 필요 표시 */
  needsReview: boolean;
  createdAt: string;
}

/** 파싱에 실패한 문자. 버리지 않는다. (ERD 2.3) */
export interface Unrecognized {
  id: string;
  /** 원문 전체 */
  raw: string;
  /** 실패 사유. 사용자에게 그대로 노출 */
  reason: ParseFailReason;
  /** 수집 시각 (epoch ms) */
  at: number;
  /** 직접 입력으로 구제된 경우 생성된 거래 id */
  resolvedTxnId: string | null;
}

/** 파싱 실패 사유 — ERD 2.3의 5가지 사유. */
export type ParseFailReason =
  | '내용이 너무 짧습니다'
  | '결제 문자가 아닌 안내 문자입니다'
  | '카드사를 찾지 못했습니다'
  | '결제 금액을 찾지 못했습니다'
  | '날짜를 읽지 못했습니다';

/** 앱 설정 (meta.settings). (ERD 2.4) */
export interface Settings {
  /** 공유 시트 수신 허용 */
  share: boolean;
  /** 클립보드 자동 감지 */
  clipboard: boolean;
  /** 중복 거래 건너뛰기 */
  dedupe: boolean;
  /** 전역 실적 주기 시작일 (1–31) */
  cycleStart: number;
  /** 구간 도달 가능성 판정 계수 */
  reachableFactor: number;
  /** 원문 보관 기간(개월) */
  rawRetentionMonths: number;
}

/** 파싱 통계 (meta.stats). 정확도 = ok / total × 100. (ERD 2.4) */
export interface ParseStats {
  /** 누적 분석 시도 건수 */
  total: number;
  /** 누적 인식 성공 건수 */
  ok: number;
  /** 카드사별 정확도 (v1.1) */
  byIssuer?: Partial<Record<IssuerKey, { total: number; ok: number }>>;
}

/**
 * 파싱 결과 — 판별 유니온.
 * 성공하면 txn과 needsReview 플래그를, 실패하면 reason과 원문을 담는다.
 */
export type ParseResult =
  | { ok: true; txn: Transaction; needsReview: boolean }
  | { ok: false; reason: ParseFailReason; raw: string };

/** 카드사 사전 항목 (parser/rules.ts). */
export interface IssuerRule {
  key: IssuerKey;
  name: string;
  regex: RegExp;
}

/** 업종 사전 항목 (parser/categories.ts). */
export interface CategoryRule {
  name: CategoryName;
  icon: string;
  keywords: string[];
}
