# TRD — 실적ON

> 기술 요구사항 문서 · v1.0 · 2026-07-24

---

## 1. 아키텍처 원칙

이 제품의 기술 결정은 전부 하나의 제약에서 나온다. **결제 데이터가 기기를 떠나지 않는다.**

이 제약이 만드는 결과:
- 서버에 비즈니스 로직이 없다. 파싱·실적 계산·최적화가 전부 클라이언트에서 돈다
- 백엔드는 정적 파일 배포와 (선택적) 암호화된 백업 보관만 담당한다
- 오프라인에서 완전히 동작해야 한다. 네트워크는 최초 로드에만 필요하다
- 사용자 인증이 없다. 세션도 없다. 서버가 사용자를 식별할 수단 자체를 두지 않는다

```
┌─────────────────── 사용자 기기 ───────────────────┐
│                                                   │
│  ┌────────────┐   ┌──────────┐   ┌────────────┐  │
│  │ 수집 계층   │──▶│ 파싱 엔진 │──▶│ 도메인 엔진 │  │
│  │ Share/     │   │ SMS      │   │ 실적 계산   │  │
│  │ Clipboard/ │   │ Parser   │   │ 최적화     │  │
│  │ Manual     │   │          │   │ 분석       │  │
│  └────────────┘   └──────────┘   └─────┬──────┘  │
│                                         │         │
│  ┌──────────────────────────────────────▼──────┐ │
│  │ 저장 계층 — IndexedDB (Dexie)                │ │
│  │ cards / transactions / unrecognized / meta   │ │
│  └──────────────────────────────────────────────┘ │
│                                         │         │
│  ┌──────────────────────────────────────▼──────┐ │
│  │ UI — Next.js App Router (전 페이지 CSR)      │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
                        │ 정적 자산만
                        ▼
              ┌──────────────────┐
              │ Vercel Edge/CDN  │  ← 로직 없음, 데이터 없음
              └──────────────────┘
```

## 2. 기술 스택

| 계층 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 14 (App Router) | 정적 내보내기로 CDN 배포, PWA 구성 용이 |
| 언어 | TypeScript 5.x (strict) | 금액 계산 도메인에서 타입 안정성이 필수 |
| 스타일 | Tailwind CSS 3.x | 디자인 토큰을 CSS 변수로 관리 |
| 컴포넌트 | shadcn/ui | 소유권이 코드에 있어 커스터마이즈 자유 |
| 로컬 DB | Dexie 4.x (IndexedDB) | localStorage의 5MB 한계와 동기 블로킹 회피 |
| 상태 | Zustand + dexie-react-hooks | 전역 상태 최소화, DB를 단일 진실 원천으로 |
| 차트 | 직접 구현 (CSS/SVG) | 막대·수평바 수준. 라이브러리 도입은 번들 낭비 |
| PWA | next-pwa 또는 수동 SW | 앱 셸 캐시 우선 전략 |
| 테스트 | Vitest + Testing Library + Playwright | 파서 단위 테스트가 품질의 8할 |
| 배포 | Vercel | 정적 호스팅, 프리뷰 배포 |

**중요: 전 페이지 클라이언트 렌더링.** 결제 데이터가 IndexedDB에만 있으므로 SSR로 렌더할 데이터가 없다. `export const dynamic = 'force-static'` + 클라이언트 컴포넌트 구조를 쓴다. 서버 컴포넌트는 정적 셸(레이아웃, 온보딩 카피)에만 쓴다.

## 3. 문자 수집 계층

### 3.1 웹 플랫폼 제약

**웹앱은 SMS를 직접 읽을 수 없다.** `SMS Retriever API`는 자사 앱으로 발송한 OTP만 읽을 수 있고, `navigator.sms`는 표준화되지 않았다. 이 제약을 우회하려 하지 않고, 사용자가 문자를 앱으로 **넘겨주는 경로**를 최대한 짧게 만든다.

### 3.2 경로별 구현

**A. Web Share Target (기본 경로 · Android)**

`manifest.json`에 선언하면 문자 앱의 공유 시트에 실적ON이 나타난다. PWA 설치가 전제 조건이다.

```json
"share_target": {
  "action": "./index.html",
  "method": "GET",
  "enctype": "application/x-www-form-urlencoded",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

앱은 부팅 시 `location.search`의 `text` 파라미터를 읽어 파싱한다. 처리 후 `history.replaceState`로 쿼리를 제거해 새로고침 시 중복 저장을 막는다.

POST 방식(`enctype: multipart/form-data`)은 서비스워커에서 요청을 가로채야 하고 iOS 미지원 폭이 크므로 GET을 쓴다. 문자 길이가 URL 한계(약 2KB)를 넘는 경우는 실무상 없다.

**B. 클립보드 자동 감지 (보조 경로 · 전 플랫폼)**

`visibilitychange` 이벤트에서 `navigator.clipboard.readText()`를 시도한다.

제약과 대응:
- Safari는 사용자 제스처 없이 읽기를 거부한다 → 실패 시 조용히 무시하고 수동 붙여넣기 버튼을 노출
- Chrome은 권한 프롬프트가 뜬다 → 설정에서 사용자가 명시적으로 켠 경우에만 시도
- 직전에 읽은 텍스트는 메모리에 캐시해 중복 팝업을 막는다

**C. iOS 단축어 자동화**

iOS '단축어' 앱 → 개인용 자동화 → "메시지를 받았을 때" 트리거. 발신자에 카드사 번호를 지정하고, 동작으로 "URL 열기"에 `https://<도메인>/?text=[메시지 내용]`을 구성한다. iOS 16 이상은 즉시 실행이 가능해 사실상 자동화된다.

앱은 A와 동일한 쿼리 파라미터 처리 경로를 탄다. 별도 코드가 필요 없다.

**D. Android 자동화 앱**

MacroDroid / Tasker 레시피: 트리거 "SMS 수신(발신자 = 카드사 번호)" → 동작 "웹페이지 열기" 또는 "HTTP GET". C와 동일하게 `?text=`로 넘긴다.

**E. 네이티브 래퍼 (v2 검토)**

Capacitor로 감싸 `READ_SMS` 권한을 쓰면 완전 자동화가 가능하지만, Google Play의 SMS 권한 정책상 기본 SMS 앱이 아닌 경우 예외 승인이 필요하고 심사 통과가 불확실하다. v1 범위에서 제외하고, 수요가 확인되면 별도 트랙으로 검토한다.

## 4. 파싱 엔진

### 4.1 설계 원칙

파서는 **규칙 기반**이다. 머신러닝을 쓰지 않는다. 이유:
- 카드사 문자는 형식이 정형화돼 있어 규칙으로 95% 이상 커버된다
- 온디바이스 모델은 번들 크기와 배터리 비용이 크다
- 실패 원인을 사람이 읽고 고칠 수 있어야 한다

### 4.2 파이프라인

```
원문
 ↓ ① 정규화     [Web발신] 등 접두 제거, 공백 정리, 개행 보존
 ↓ ② 안내 문자 판별   청구금액/명세서/이벤트 → 조기 반려
 ↓ ③ 카드사 식별     정규식 사전 13종, 우선순위 매칭
 ↓ ④ 금액 추출       "누적/잔여/한도/포인트/합계/총" 선행어 배제
 ↓ ⑤ 뒷자리 추출     (1234) 또는 카드1234
 ↓ ⑥ 일시 추출       MM/DD + HH:MM, 미래 월이면 전년도 보정
 ↓ ⑦ 할부 추출       N개월 / 일시불
 ↓ ⑧ 가맹점 추출     3단 폴백 (할부표기 후 → 시각 후 → 날짜 후)
 ↓ ⑨ 업종 분류       키워드 사전 15개 업종
 ↓ ⑩ 취소 판정       취소 키워드 시 금액 음수화
결과 { ok, txn } 또는 { ok:false, reason, raw }
```

### 4.3 핵심 로직: 금액 오인식 방지

가장 흔한 오류는 **누적금액을 결제금액으로 읽는 것**이다.

```ts
const SKIP_BEFORE = /(누적|누계|잔액|잔여|한도|포인트|합계|총|적립|월)\s*[^0-9]{0,4}$/;
const AMOUNT = /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,9})\s*원/g;

let amount = null, cumulative = null;
let m: RegExpExecArray | null;
while ((m = AMOUNT.exec(flat)) !== null) {
  const val = parseInt(m[1].replace(/,/g, ''), 10);
  const before = flat.slice(Math.max(0, m.index - 10), m.index);
  if (SKIP_BEFORE.test(before)) { cumulative ??= val; continue; }
  amount ??= val;
}
```

누적금액도 버리지 않고 `cumulative`로 보관한다. 사용자가 입력한 실적 합계와 카드사가 알려준 누적이 어긋나면 **누락된 문자가 있다는 신호**이므로, 대시보드에서 대조 경고를 띄운다.

### 4.4 가맹점 추출 폴백

```ts
const PATTERNS = [
  /(?:일시불|\d{1,2}개월)\s*(?:\d{1,2}[\/.]\d{1,2})?\s*(?:\d{1,2}:\d{2})?\s*(.+)$/,
  /\d{1,2}:\d{2}\s*(.+)$/,
  /\d{1,2}[\/.]\d{1,2}\s*(.+)$/,
];
```

세 패턴을 순서대로 시도하고, 추출 후 잔여 노이즈(`승인`, `님`, 금액 표기)를 제거한다. 2자 미만이면 `needsReview` 플래그를 세워 "가맹점 미상"으로 저장하되 거래 자체는 살린다. **금액과 카드사만 맞으면 실적 계산은 가능하기 때문**이다.

### 4.5 파서 검증 요건

- 주요 8개 카드사 × 각 5개 이상 실제 문자 형식 = 40건 이상의 골든 테스트 케이스
- 승인/취소/할부/누적표기 유무 조합 커버
- 안내 문자(청구·이벤트·한도상향) 반려 케이스 10건 이상
- **회귀 테스트 필수**: 파서 규칙 수정 시 전체 골든 케이스 통과 없이 머지 금지

파싱 규칙은 `lib/parser/rules.ts`에 데이터로 분리한다. 카드사 문자 형식이 바뀌면 규칙 파일만 고치고 배포한다.

## 5. 도메인 엔진

### 5.1 실적 주기

```ts
function cycleRange(now: Date, startDay: number): { start: Date; end: Date } {
  let start = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now.getDate() < startDay) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
  }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
  return { start, end };
}
```

`startDay`가 29~31일인 경우 해당 월에 그 날짜가 없으면 말일로 보정한다. v1은 전역 설정 1개, v1.1에서 카드별로 분리한다.

### 5.2 실적 집계

```
실적 = Σ(주기 내 거래 금액) − Σ(실적 제외 거래) − Σ(취소 거래)
```

- 취소 거래는 음수 금액으로 저장되므로 단순 합산에 포함된다
- 제외 판정 우선순위: `거래.excludedManual`(사용자 수동 지정) > `카드.excludes`(카드별 업종 목록) > 기본 제외 목록
- 할부는 v1에서 승인월 전액 반영. `installmentPolicy` 필드를 카드에 두고 v1.1에서 분할 옵션 추가

### 5.3 최적화 알고리즘

```
1. 활성 카드 전체의 실적 계산
2. 미달 카드를 "다음 구간까지 남은 금액" 오름차순 정렬 → 1순위가 이번 주기의 타깃 카드
3. 각 카드마다 조치 생성:
   - 최고 구간 초과  → type: over,      대체 카드 = 타깃 카드, 예상 이득 = 타깃의 nextGain
   - 다음 구간 존재  → 필요액 / 남은 일수 = 일 필요액
                      현재 소비 속도로 도달 가능 여부 판정
                      가능 → type: fill-need, 예상 이득 = nextGain
                      불가 → type: ok,        예상 이득 = 0, 포기 권고
4. 초과 조치를 최상단으로, 그다음 예상 이득 내림차순 정렬
```

도달 가능성 판정:

```ts
const elapsed = Math.max(1, totalDays - daysLeft);
const dailyPace = sum / elapsed;
const reachable = dailyPace * daysLeft >= need * 0.8;
```

0.8 계수는 사용자가 약간의 노력을 더한다는 가정이다. 이 값은 튜닝 대상이며 상수로 분리해 관리한다.

### 5.4 계산 정확도

- 모든 금액은 **원 단위 정수**로 다룬다. 부동소수점 금액 연산 금지
- 적립률 계산 결과는 `Math.floor`로 절사 (카드사 관행)
- 표시 시에만 `toLocaleString('ko-KR')` 적용

## 6. 저장 계층

### 6.1 Dexie 스키마

```ts
db.version(1).stores({
  cards:        'id, issuer, last4, active',
  transactions: 'id, cardId, date, category, issuer, [cardId+date]',
  unrecognized: 'id, at',
  meta:         'key',
});
```

복합 인덱스 `[cardId+date]`가 실적 집계 쿼리의 핵심이다. 거래가 수천 건 쌓여도 주기별 조회가 상수 시간에 가깝다.

### 6.2 마이그레이션

Dexie의 `version().upgrade()`로 관리한다. 스키마 변경 시 이전 버전 데이터를 반드시 보존한다. **사용자 데이터가 서버에 없으므로 마이그레이션 실패는 곧 영구 소실이다.**

마이그레이션 전 자동 스냅샷을 `meta` 테이블에 JSON으로 저장하고, 실패 시 롤백한다.

### 6.3 백업

- 내보내기: 전체 DB를 JSON 단일 파일로 직렬화, `Blob` + `<a download>`로 저장
- 가져오기: 파일 선택 → 스키마 버전 확인 → 병합 또는 덮어쓰기 선택
- 리마인더: 마지막 백업 후 30일 경과 시 대시보드에 안내 배너

### 6.4 용량 관리

거래 1건 약 400바이트. 월 200건 × 5년 = 12,000건 ≈ 5MB. IndexedDB 할당량 내에서 충분하다. 단, 원문(`raw`)이 용량의 절반을 차지하므로 **12개월이 지난 거래는 원문을 삭제**하고 파싱 결과만 남기는 정리 작업을 둔다.

## 7. PWA 요구사항

| 항목 | 요구 |
|---|---|
| 설치 가능 | manifest + HTTPS + 서비스워커 등록 |
| 오프라인 | 앱 셸 캐시 우선. 네트워크 실패 시 캐시된 index로 폴백 |
| 아이콘 | 192/512 PNG, maskable 포함 |
| 표시 모드 | standalone, portrait 고정 |
| 세이프 에어리어 | `viewport-fit=cover` + `env(safe-area-inset-bottom)` |
| 캐시 전략 | 앱 셸: Cache First / 공유 타깃 요청: 캐시된 셸로 응답 |
| 업데이트 | SW `skipWaiting` + `clients.claim`. 새 버전 감지 시 갱신 안내 토스트 |

**서비스워커 주의**: 공유 시트 요청(`?text=...`)이 캐시 미스로 네트워크를 타면 오프라인에서 실패한다. `fetch` 핸들러에서 쿼리 파라미터를 감지해 캐시된 `index.html`로 응답한다.

## 8. 성능 목표

| 지표 | 목표 |
|---|---|
| 최초 로드 (3G) | LCP 2.5초 이내 |
| 재방문 로드 | 1.0초 이내 (SW 캐시) |
| 문자 1건 파싱 | 5ms 이내 |
| 문자 50건 일괄 처리 | 500ms 이내 |
| 실적 재계산 (거래 5,000건) | 100ms 이내 |
| JS 번들 (gzip) | 180KB 이내 |
| Lighthouse PWA | 100점 |

거래 건수가 많아지면 실적 계산을 매 렌더마다 하지 않도록 주기별 집계 결과를 메모이즈한다. 무효화 키는 `(cycleStart, txnCount, lastTxnId, cardsHash)`.

## 9. 접근성 · 품질 기준

- 대비비 WCAG AA (본문 4.5:1, 큰 글씨 3:1). 형광 노랑(#F2E14B)은 **배경으로만** 사용하고 그 위 텍스트는 잉크색으로 고정
- 모든 인터랙티브 요소에 `:focus-visible` 아웃라인
- 토글은 `role="switch"` + `aria-checked`
- `prefers-reduced-motion` 존중 — 게이지 애니메이션 제거
- 최소 터치 타깃 44×44px
- 금액은 `font-variant-numeric: tabular-nums`로 자릿수 정렬

## 10. 보안

| 위협 | 대응 |
|---|---|
| XSS로 결제 내역 탈취 | 모든 사용자 입력·문자 원문 렌더 시 이스케이프. `dangerouslySetInnerHTML` 금지. CSP 헤더 적용 |
| 서드파티 스크립트 유출 | 외부 스크립트 반입 금지. 애널리틱스 미도입. 폰트는 self-host 또는 프리로드된 CDN 1곳 |
| 공유 URL에 결제 정보 잔류 | 처리 즉시 `history.replaceState`로 쿼리 제거. 브라우저 히스토리에 남지 않도록 |
| 기기 분실 | 브라우저 잠금에 의존. 앱 자체 PIN 잠금은 v1.1 |
| 클립보드 오·수집 | 파싱 성공한 경우에만 저장 확인을 묻는다. 실패한 텍스트는 즉시 폐기 |

**CSP 예시**

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
font-src 'self' https://cdn.jsdelivr.net;
connect-src 'self';
img-src 'self' data:;
```

`connect-src 'self'`가 중요하다. 이 앱은 외부로 어떤 요청도 보내지 않으며, CSP로 그것을 **강제**한다.

## 11. 디렉터리 구조

```
src/
├─ app/
│  ├─ layout.tsx                 정적 셸
│  ├─ page.tsx                   탭 컨테이너 (클라이언트)
│  └─ globals.css                디자인 토큰
├─ components/
│  ├─ dashboard/  HeroPick, CardGauge, RecentTxns
│  ├─ cards/      CardList, CardEditor, PresetPicker
│  ├─ sms/        Ingest, CollectSettings, Unrecognized
│  ├─ optimize/   ActionList, CategoryBest
│  ├─ stats/      MonthlyBars, CategoryBars, YearlyOutlook
│  └─ ui/         shadcn 컴포넌트
├─ lib/
│  ├─ parser/     index.ts, rules.ts, categories.ts, __tests__/
│  ├─ domain/     cycle.ts, performance.ts, optimize.ts, analytics.ts
│  ├─ db/         schema.ts, migrations.ts, backup.ts
│  └─ share/      shareTarget.ts, clipboard.ts
├─ store/         useAppStore.ts
└─ types/         index.ts
public/
├─ manifest.json, sw.js, icon-192.png, icon-512.png
```

## 12. 테스트 전략

| 계층 | 도구 | 커버리지 목표 |
|---|---|---|
| 파서 | Vitest (골든 케이스 40건+) | 100% 분기 |
| 도메인 엔진 | Vitest | 90% 이상 |
| 컴포넌트 | Testing Library | 주요 상태 전이 |
| E2E | Playwright | 온보딩·문자입력·최적화 3개 시나리오 |

**파서 테스트가 최우선이다.** 금액을 잘못 읽으면 앱 전체가 틀린 조언을 한다. 실제 카드사 문자를 수집해 골든 케이스로 고정하고, 개인정보(이름·카드번호)는 마스킹해 픽스처로 커밋한다.

## 13. 배포 · 운영

- `main` 브랜치 푸시 → Vercel 프로덕션 자동 배포
- PR → 프리뷰 URL (실기기 테스트용 QR 생성)
- 사용자 데이터를 서버가 보유하지 않으므로 **롤백이 안전하다.** 단, DB 스키마 버전을 올린 배포는 롤백 시 하위 호환 확인 필수
- 에러 리포팅: 결제 데이터가 스택에 실릴 위험이 있어 자동 수집 도구를 도입하지 않는다. 대신 사용자가 스스로 진단 정보를 복사해 제보하는 버튼을 제공하고, 복사 전 금액·가맹점을 마스킹한다

## 14. 기술 부채 목록 (v1 인지 후 감수)

- 카드사별 실적 주기 차이 미반영 → v1.1
- 할부 실적 반영 정책 카드별 미분기 → v1.1
- 업종별 적립 한도(월 캡) 미계산 → v1.1
- 파서 규칙이 한국 카드사에 하드코딩 → 해외 확장 시 재설계 필요
- 프로토타입은 `localStorage` 기반. 프로덕션 구현 시 Dexie로 전환 필수
