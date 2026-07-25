# ERD — 실적ON

> 데이터 모델 · v1.0 · 2026-07-24
> 저장 위치: 사용자 기기의 IndexedDB. 서버 데이터베이스는 존재하지 않는다.

---

## 1. 개체 관계도

```
┌──────────────────┐
│      Card        │  보유 카드
│──────────────────│
│ PK id            │
│    issuer        │
│    name          │
│    last4         │
│    annualFee     │
│    cycleStartDay │
│    active        │
└────────┬─────────┘
         │ 1
         │
         ├───────────< N ┌──────────────────┐
         │               │      Tier        │  실적 구간 (Card에 내장)
         │               │──────────────────│
         │               │    label         │
         │               │    min           │
         │               │    benefit       │
         │               └──────────────────┘
         │
         ├───────────< N ┌──────────────────┐
         │               │   CategoryRate   │  업종별 적립 (Card에 내장)
         │               │──────────────────│
         │               │ FK category      │
         │               │    rate          │
         │               │    monthlyCap    │
         │               └────────┬─────────┘
         │                        │ N
         │                        │
         │ 1                      ▼ 1
         │               ┌──────────────────┐
         └───────< N ────│   Transaction    │  결제 거래
                         │──────────────────│
                         │ PK id            │
                         │ FK cardId  (NULL 허용)
                         │ FK category      │
                         │    amount        │
                         │    date          │
                         │    merchant      │
                         │    installment   │
                         │    canceled      │
                         │    excludedManual│
                         │    raw           │
                         │    source        │
                         └──────────────────┘
                                  │ N
                                  ▼ 1
                         ┌──────────────────┐
                         │    Category      │  업종 (상수 사전)
                         │──────────────────│
                         │ PK name          │
                         │    icon          │
                         │    keywords[]    │
                         └──────────────────┘

┌──────────────────┐          ┌──────────────────┐
│  Unrecognized    │          │      Meta        │
│  미인식 문자      │          │  설정·통계        │
│──────────────────│          │──────────────────│
│ PK id            │          │ PK key           │
│    raw           │          │    value (JSON)  │
│    reason        │          └──────────────────┘
│    at            │
│    resolvedTxnId │──┐
└──────────────────┘  │ 0..1
                      └──▶ Transaction
```

**관계 요약**

| 관계 | 카디널리티 | 비고 |
|---|---|---|
| Card ─ Transaction | 1 : N | `cardId`는 NULL 허용. 문자를 읽었지만 어느 카드인지 못 정한 상태 |
| Card ─ Tier | 1 : N | Card 문서에 배열로 내장. 별도 테이블 아님 |
| Card ─ CategoryRate | 1 : N | Card 문서에 배열로 내장 |
| Category ─ Transaction | 1 : N | Category는 코드 상수. 테이블 없음 |
| Unrecognized ─ Transaction | 1 : 0..1 | 사용자가 직접 입력해 구제하면 연결 |

**정규화하지 않은 이유** — Tier와 CategoryRate를 Card 안에 배열로 둔다. 항상 Card와 함께 읽고 함께 쓰며, 단독 조회가 없다. IndexedDB는 문서형 저장소이므로 조인 비용이 관계형 DB보다 크다.

---

## 2. 테이블 정의

### 2.1 `cards`

보유 카드와 그 조건. 사용자가 직접 입력·관리한다.

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|:--:|---|---|
| `id` | string | ✓ | uid() | 기본키 |
| `issuer` | IssuerKey | ✓ | | 카드사 키. 문자 매칭에 사용 |
| `name` | string | ✓ | | 사용자 지정 카드 이름 |
| `last4` | string(4) | | `''` | 카드 뒷 4자리. **전체 카드번호는 저장하지 않는다** |
| `annualFee` | int | ✓ | 0 | 연회비(원). 연간 전망에서 차감 |
| `tiers` | Tier[] | ✓ | `[]` | 실적 구간 배열. `min` 오름차순 정렬 유지 |
| `excludes` | string[] | ✓ | 기본 3종 | 실적 제외 업종명 배열 |
| `rates` | CategoryRate[] | | `[]` | 업종별 적립 조건 |
| `cycleStartDay` | int(1–31) | | null | 카드별 주기 시작일. null이면 전역 설정 사용 (v1.1) |
| `installmentPolicy` | enum | | `'full'` | `full`=승인월 전액, `split`=청구월 분할 (v1.1) |
| `active` | boolean | ✓ | true | false면 계산·추천에서 제외. 삭제 대신 비활성 권장 |
| `createdAt` | ISO string | ✓ | now | |
| `updatedAt` | ISO string | ✓ | now | 6개월 이상 미수정 시 조건 재확인 안내 트리거 |

**인덱스** — `id`(PK), `issuer`, `last4`, `active`

**제약**
- `tiers[].min`은 서로 달라야 하며 0보다 커야 한다
- `tiers`가 빈 배열이면 무실적 카드로 취급하고 게이지 대신 누적 금액만 표시
- `last4`는 숫자 4자리 또는 빈 문자열
- **금지 필드**: 카드번호 전체, 유효기간, CVC, 비밀번호, 명의자 주민번호. 스키마에 자리를 두지 않는다

**내장 타입: Tier**

| 필드 | 타입 | 설명 |
|---|---|---|
| `label` | string | 표시용 라벨. 예 `"30만"` |
| `min` | int | 이 구간이 열리는 실적 기준액(원) |
| `benefit` | int | 이 구간 달성 시 월 예상 혜택(원). 사용자 입력값 |

**내장 타입: CategoryRate**

| 필드 | 타입 | 설명 |
|---|---|---|
| `category` | string | 업종명. Category 사전의 값 |
| `rate` | float | 적립·할인율(%) |
| `monthlyCap` | int \| null | 월 한도(원). null이면 무제한 (v1.1에서 계산 반영) |

---

### 2.2 `transactions`

결제 1건. 문자 파싱 또는 직접 입력으로 생성된다.

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|:--:|---|---|
| `id` | string | ✓ | uid() | 기본키 |
| `cardId` | string \| null | ✓ | null | `cards.id` 참조. **NULL 허용** |
| `issuer` | IssuerKey | ✓ | | 파싱 시점의 카드사. cardId가 없어도 남는다 |
| `issuerName` | string | ✓ | | 표시용 카드사명 |
| `last4` | string | | `''` | 파싱된 뒷자리. 카드 매칭 키 |
| `amount` | int | ✓ | | 결제 금액(원). **취소 거래는 음수** |
| `date` | ISO string | ✓ | | 승인 일시 |
| `merchant` | string | ✓ | `'가맹점 미상'` | 가맹점명 |
| `category` | string | ✓ | `'기타'` | 업종. 자동 분류 후 사용자 수정 가능 |
| `installment` | int | ✓ | 0 | 할부 개월. 0이면 일시불 |
| `canceled` | boolean | ✓ | false | 취소 거래 여부 |
| `cumulative` | int \| null | | null | 문자에 적힌 누적금액. 대조 검증용 |
| `excludedManual` | boolean \| null | ✓ | null | 실적 반영 수동 지정. null이면 업종 규칙에 위임 |
| `raw` | string | | `''` | 원본 문자. 12개월 후 자동 삭제 |
| `source` | enum | ✓ | `'sms'` | `sms` \| `share` \| `clipboard` \| `manual` |
| `needsReview` | boolean | | false | 가맹점 추출 실패 등 확인 필요 표시 |
| `createdAt` | ISO string | ✓ | now | |

**인덱스** — `id`(PK), `cardId`, `date`, `category`, `issuer`, 복합 `[cardId+date]`

**제약**
- `amount`는 0이 될 수 없다
- `canceled === true`이면 `amount < 0`
- `cardId`가 null인 거래는 실적 계산에 포함되지 않는다. 대시보드에 "카드 미지정" 배지로 노출해 사용자에게 지정을 유도한다

**중복 판정 키** — `(issuer, amount, date)` 일치 시 동일 거래로 간주하고 저장하지 않는다. 설정에서 끌 수 있다.

**`excludedManual` 3상태의 의미**

| 값 | 의미 |
|---|---|
| `null` | 업종 규칙에 맡긴다 (기본) |
| `false` | 업종상 제외 대상이지만 **실적에 포함**하라고 사용자가 지정 |
| `true` | 업종상 포함 대상이지만 **실적에서 제외**하라고 사용자가 지정 |

카드사마다 제외 업종이 미묘하게 다르므로 사용자 판단이 규칙을 이긴다.

---

### 2.3 `unrecognized`

파싱에 실패한 문자. **버리지 않는다.**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| `id` | string | ✓ | 기본키 |
| `raw` | string | ✓ | 원문 전체 |
| `reason` | string | ✓ | 실패 사유. 사용자에게 그대로 노출 |
| `at` | int | ✓ | 수집 시각 (epoch ms) |
| `resolvedTxnId` | string \| null | | 직접 입력으로 구제된 경우 생성된 거래 id |

**인덱스** — `id`(PK), `at`

**보관 정책** — 최대 30건, `at` 내림차순 유지. 초과분은 오래된 것부터 삭제.

**실패 사유 코드**

| reason | 발생 조건 |
|---|---|
| `내용이 너무 짧습니다` | 정규화 후 6자 미만 |
| `결제 문자가 아닌 안내 문자입니다` | 청구·명세서·이벤트 키워드 + 승인 키워드 부재 |
| `카드사를 찾지 못했습니다` | 카드사 사전 미매칭 |
| `결제 금액을 찾지 못했습니다` | 금액 패턴 없음 또는 전부 누적금액으로 판정됨 |
| `날짜를 읽지 못했습니다` | 날짜 조합이 유효하지 않음 |

---

### 2.4 `meta`

키-값 저장소. 설정과 통계.

| key | value 타입 | 설명 |
|---|---|---|
| `settings` | Settings | 앱 설정 |
| `stats` | ParseStats | 파싱 통계 |
| `schemaVersion` | int | 마이그레이션 기준 |
| `lastBackupAt` | int \| null | 마지막 내보내기 시각 |
| `snapshot` | string | 마이그레이션 직전 자동 스냅샷 (JSON) |

**Settings**

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `share` | boolean | true | 공유 시트 수신 허용 |
| `clipboard` | boolean | false | 클립보드 자동 감지 |
| `dedupe` | boolean | true | 중복 거래 건너뛰기 |
| `cycleStart` | int(1–31) | 1 | 전역 실적 주기 시작일 |
| `reachableFactor` | float | 0.8 | 구간 도달 가능성 판정 계수 |
| `rawRetentionMonths` | int | 12 | 원문 보관 기간 |

**ParseStats**

| 필드 | 타입 | 설명 |
|---|---|---|
| `total` | int | 누적 분석 시도 건수 |
| `ok` | int | 누적 인식 성공 건수 |
| `byIssuer` | Record<IssuerKey, {total, ok}> | 카드사별 정확도 (v1.1) |

정확도 = `ok / total × 100`. 이 값이 90% 아래로 떨어지면 파서 규칙 점검 신호다.

---

## 3. 상수 사전 (테이블 아님)

### 3.1 Issuer

코드에 하드코딩된 13종. 각 항목은 `{ key, name, regex }`.

`shinhan` · `kb` · `samsung` · `hyundai` · `lotte` · `woori` · `hana` · `nh` · `bc` · `ibk` · `kakao` · `toss` · `etc`

**매칭 순서가 중요하다.** `국민카드`와 `KB`가 같은 항목을 가리키고, `NH`와 `농협`이 같은 항목을 가리킨다. `etc`는 최후 폴백이므로 항상 마지막에 둔다.

### 3.2 Category

15개 업종. 각 항목은 `{ name, icon, keywords[] }`.

| 업종 | 아이콘 | 실적 제외 기본값 |
|---|:--:|:--:|
| 편의점 | 🏪 | |
| 카페 | ☕ | |
| 음식점 | 🍚 | |
| 마트/식료품 | 🛒 | |
| 온라인쇼핑 | 📦 | |
| 교통 | 🚇 | |
| 주유/충전 | ⛽ | |
| 통신 | 📱 | |
| 의료/약국 | 💊 | |
| 문화/구독 | 🎬 | |
| 백화점/아울렛 | 🏬 | |
| 생활/뷰티 | 🧴 | |
| 보험/금융 | 🏦 | ✓ |
| 공과금/세금 | 🧾 | ✓ |
| 상품권/충전 | 🎟️ | ✓ |
| 기타 | • | |

분류는 가맹점명에 키워드가 포함되는지로 판정한다. **먼저 매칭된 업종이 이긴다**. 따라서 사전 순서가 곧 우선순위이며, 좁은 범위(편의점)를 넓은 범위(마트/식료품) 앞에 둔다.

기본 제외 3종은 대부분의 카드사가 공통으로 실적에서 빼는 업종이다. 카드사마다 다르므로 카드별로 수정할 수 있어야 한다.

---

## 4. 파생 데이터 (저장하지 않음)

계산으로 얻는 값은 저장하지 않는다. 저장하면 원본과 어긋날 위험이 생긴다.

| 값 | 계산식 |
|---|---|
| 카드별 실적 | `Σ 주기 내 거래 − Σ 제외 거래` |
| 현재 구간 | `tiers` 중 `min ≤ 실적`인 마지막 항목 |
| 다음 구간 | `tiers` 중 `min > 실적`인 첫 항목 |
| 진행률 | `min(100, 실적 / 최고구간.min × 100)` |
| 초과 금액 | `실적 > 최고구간.min ? 실적 − 최고구간.min : 0` |
| 확보 혜택 | `현재구간.benefit` |
| 다음 구간 이득 | `다음구간.benefit − 현재구간.benefit` |
| 일 필요액 | `⌈(다음구간.min − 실적) / 남은일수⌉` |
| 연간 전망 | `(월 혜택 합 × 12) − Σ 연회비` |

**메모이제이션 키** — `(cycleStart, transactions.length, 마지막 거래 id, cards 해시)`. 이 중 하나라도 바뀌면 재계산한다.

---

## 5. 데이터 흐름

**문자 1건이 들어와 실적이 되기까지**

```
원문 문자
   │
   ├─ 파싱 실패 ──▶ unrecognized 삽입 ──▶ 사용자 직접 입력 ──┐
   │                                                        │
   └─ 파싱 성공                                              │
        │                                                   │
        ├─ 중복 판정 (issuer, amount, date) ─── 중복 ──▶ 폐기 │
        │                                                   │
        └─ 카드 매칭                                         │
             ├─ (issuer + last4) 일치 ──▶ cardId 확정        │
             ├─ 같은 issuer 카드 1장 ────▶ cardId 확정        │
             └─ 그 외 ──────────────────▶ cardId = null      │
                  │                                          │
                  ▼                                          ▼
             transactions 삽입 ◀───────────────────────────────┘
                  │
                  ▼
             실적 재계산 → 구간 판정 → 최적화 조치 갱신 → UI
```

**카드 등록 시 소급 매칭** — 새 카드를 저장하면 `cardId === null`인 기존 거래 전체를 다시 매칭한다. 문자를 먼저 넣고 카드를 나중에 등록해도 실적이 채워지는 이유다.

---

## 6. 무결성 규칙

| # | 규칙 | 위반 시 |
|---|---|---|
| 1 | `cards.tiers`는 `min` 오름차순 정렬 상태를 유지한다 | 저장 시 자동 정렬 |
| 2 | 카드 삭제 시 해당 거래의 `cardId`를 null로 만든다. **거래를 함께 지우지 않는다** | 데이터 손실 방지 |
| 3 | `amount === 0`인 거래는 생성하지 않는다 | 저장 거부 |
| 4 | `canceled === true`면 `amount < 0`을 보장한다 | 저장 시 부호 보정 |
| 5 | `last4`는 정확히 4자리 숫자이거나 빈 문자열 | 입력 시 비숫자 제거 후 4자리 절사 |
| 6 | `unrecognized`는 30건을 넘지 않는다 | 오래된 항목부터 삭제 |
| 7 | `raw`는 `rawRetentionMonths` 경과 후 빈 문자열로 대체한다 | 앱 시작 시 정리 작업 |
| 8 | 마이그레이션 전 `meta.snapshot`에 전체 백업을 남긴다 | 실패 시 롤백 |

**규칙 2가 특히 중요하다.** 카드를 실수로 지웠을 때 몇 달치 결제 내역이 함께 사라지면 복구할 방법이 없다. 서버 백업이 없는 구조의 대가다.

---

## 7. 백업 포맷

```json
{
  "app": "siljeokon",
  "schemaVersion": 1,
  "exportedAt": "2026-07-24T10:00:00.000Z",
  "cards": [ ... ],
  "transactions": [ ... ],
  "unrecognized": [ ... ],
  "meta": { "settings": { ... }, "stats": { ... } }
}
```

**가져오기 시 검증**
1. `app` 필드가 `siljeokon`인지 확인
2. `schemaVersion`이 현재 버전 이하인지 확인. 초과하면 앱 업데이트 안내
3. 병합 또는 덮어쓰기를 사용자에게 묻는다
4. 병합 시 `transactions`는 중복 판정 키로 걸러 넣는다

백업 파일에는 카드 뒷 4자리, 가맹점명, 금액이 평문으로 들어간다. **파일 자체가 민감 정보**임을 내보내기 시점에 명확히 알린다.
