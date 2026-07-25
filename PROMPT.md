# PROMPT — 실적ON

> AI 개발 프롬프트 모음 · v1.0
> 사용 방식: 한 번에 한 프롬프트씩. 이전 단계가 통과한 뒤 다음으로 넘어간다.

---

## 0. 세션 시작 시 항상 붙이는 컨텍스트

```
프로젝트: 실적ON — 신용카드 실적 관리 모바일 웹앱(PWA)

핵심 원칙 (모든 결정의 기준):
1. 결제 데이터는 사용자 기기를 절대 벗어나지 않는다. 서버 전송, 외부 API 호출, 애널리틱스 없음.
2. 사용자를 오래 붙잡지 않는다. 답을 3초 안에 주고 끝낸다.
3. "더 쓰세요"만 말하지 않는다. 도달이 어려우면 포기를 권한다.
4. 숫자를 단정하지 않는다. 카드사 정책은 사용자 입력값을 신뢰한다.

기술 스택:
- Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- Dexie(IndexedDB), Zustand
- 전 페이지 클라이언트 렌더링. 서버 컴포넌트는 정적 셸에만.
- 외부 런타임 의존성 없음. 차트는 CSS/SVG 직접 구현.

디자인 토큰:
--paper #E9ECF1  --surface #FFFFFF  --ink #101B2D  --ink-2 #3A4761
--mute #8590A3   --line #DBE1EA     --hl #F2E14B(형광, 배경 전용)
--go #0F9E8E     --warn #FF6A4D     --blue #2F5BEA
본문 Pretendard, 금액은 등폭(tabular-nums) 폰트.

시그니처 UI: 카드가 곧 게이지다. 플라스틱 카드 모양 안에서 실적이 왼쪽부터 차오르고,
실적 구간이 카드 위 세로 눈금으로 새겨진다.

참조 문서: PRD.md, TRD.md, ERD.md
작업 규칙: 한 번에 하나의 작업만 수행하고, 완료 후 다음 단계를 제안하되 실행하지 않는다.
```

---

## 1. 프로젝트 초기화

```
Next.js 14 App Router 프로젝트를 초기화해 줘.

- TypeScript strict 모드
- Tailwind CSS, ESLint, App Router, src 디렉터리 사용
- shadcn/ui 초기화 (스타일 default, base color slate)
- Dexie, zustand, dexie-react-hooks 설치
- Vitest + @testing-library/react 설정

globals.css에 위 디자인 토큰을 CSS 변수로 정의하고,
tailwind.config.ts의 theme.extend.colors에 매핑해 줘.
폰트는 Pretendard를 next/font로 self-host 설정.

디렉터리 구조는 TRD.md 11절을 그대로 따라 만들고, 각 폴더에 .gitkeep을 둬.
아직 화면은 만들지 마.
```

---

## 2. 타입 정의

```
ERD.md를 읽고 src/types/index.ts에 전체 타입을 정의해 줘.

정의할 타입: IssuerKey, CategoryName, Tier, CategoryRate, Card,
Transaction, Unrecognized, Settings, ParseStats, ParseResult

요구사항:
- 금액은 전부 number이되, 원 단위 정수임을 주석으로 명시
- excludedManual은 boolean | null 3상태. 각 값의 의미를 JSDoc으로 설명
- ParseResult는 판별 유니온:
  { ok: true; txn: Transaction; needsReview: boolean }
  | { ok: false; reason: ParseFailReason; raw: string }
- ParseFailReason은 ERD.md 2.3절의 5가지 사유를 리터럴 유니온으로

금지: 카드번호 전체, 유효기간, CVC, 비밀번호 관련 필드를 어떤 이름으로도 만들지 마.
```

---

## 3. 상수 사전

```
src/lib/parser/rules.ts와 categories.ts를 만들어 줘.

rules.ts — 카드사 사전 13종
ERD.md 3.1절의 키 목록을 그대로 쓰고, 각 항목은 { key, name, regex }.
매칭 순서가 곧 우선순위다. 'etc'를 반드시 마지막에 둬.
'국민카드|KB국민|KB카드'가 kb로, '농협|NH'가 nh로 잡히도록 정규식을 짜.

categories.ts — 업종 사전 15종
ERD.md 3.2절 표를 그대로 옮기고, 각 항목은 { name, icon, keywords[] }.
좁은 범위를 넓은 범위 앞에 둬 (편의점이 마트/식료품보다 먼저).
classify(merchant: string): CategoryName 함수도 함께 만들어.
대소문자 무시 비교. 매칭 실패 시 '기타' 반환.
DEFAULT_EXCLUDE 상수로 기본 제외 3종을 내보내.

두 파일 모두 데이터와 로직을 분리해서, 사전만 고쳐도 동작이 바뀌게 만들어.
```

---

## 4. 파싱 엔진 ★ 가장 중요

```
src/lib/parser/index.ts에 parseSMS(raw: string): ParseResult를 구현해 줘.

TRD.md 4.2절의 10단계 파이프라인을 그대로 따라.

특히 주의할 것 — 금액 추출:
카드사 문자에는 결제금액과 누적금액이 함께 온다. 누적을 결제로 읽으면
앱 전체가 틀린 조언을 한다. 정규식으로 모든 "N원"을 찾되, 직전 10자에
(누적|누계|잔액|잔여|한도|포인트|합계|총|적립|월)이 있으면 결제금액 후보에서
빼고 cumulative로 따로 보관해.

가맹점 추출은 3단 폴백:
① (일시불|N개월) 뒤 → ② 시각(HH:MM) 뒤 → ③ 날짜(MM/DD) 뒤
추출 후 '승인','취소','일시불','님', 금액 표기를 제거.
2자 미만이면 needsReview: true, merchant는 '가맹점 미상'으로 두되
거래는 살려. 금액과 카드사만 맞으면 실적 계산은 가능하니까.

날짜: MM/DD가 현재 월+2를 넘으면 전년도로 보정.
취소 키워드가 있으면 amount를 음수로.
'청구금액|명세서|안내드립|이벤트|광고' 등 안내성 문자는 조기 반려.

parseSMS 함수는 순수 함수여야 한다. DB 접근, 부수효과 없음.
splitMessages(text: string): string[]도 함께 만들어.
빈 줄로 블록을 나누고, 한 블록에 [Web발신]이 여러 번 나오면 다시 쪼개.
```

---

## 5. 파서 테스트 ★ 반드시 4번 직후에

```
src/lib/parser/__tests__/parser.test.ts를 작성해 줘.

골든 케이스 40건 이상. 카드사 8곳(신한, KB국민, 삼성, 현대, 롯데, 우리, 하나, NH농협)
× 각 5개 형식:
1) 다중 행 + 누적금액 포함
2) 단일 행 압축형
3) 할부 결제
4) 취소 문자
5) 시각 없이 날짜만

추가로 반려되어야 하는 케이스 10건:
청구금액 안내, 이벤트, 한도 상향, 무이자 행사, 빈 문자열,
카드사명 없는 문자, 금액 없는 문자 등.

각 케이스마다 issuer, amount, last4, date, merchant, category,
installment, canceled를 전부 검증해.

픽스처의 이름은 '홍*동', 카드번호는 임의 4자리로 마스킹.
실제 개인정보를 절대 넣지 마.

테스트가 전부 통과할 때까지 파서를 수정해. 테스트를 느슨하게 고치지 말고
파서를 고쳐. 통과하면 실패 사례를 요약해서 알려 줘.
```

---

## 6. 저장 계층

```
src/lib/db/schema.ts에 Dexie 스키마를 구현해 줘.

TRD.md 6.1절의 인덱스 정의를 그대로 쓰고, 복합 인덱스 [cardId+date]를 반드시 포함.

함께 만들 것:
- 각 테이블의 CRUD 헬퍼 (cards, transactions, unrecognized, meta)
- ERD.md 6절의 무결성 규칙 8개를 저장 시점에 강제하는 로직
  특히 규칙 2: 카드 삭제 시 거래를 지우지 말고 cardId만 null로 만든다
- getSettings() / setSettings()는 meta 테이블 기반, 기본값 병합 처리
- 앱 시작 시 실행할 cleanup(): 12개월 지난 거래의 raw를 빈 문자열로,
  unrecognized 30건 초과분 삭제

migrations.ts에는 version().upgrade() 구조를 잡아 두고,
업그레이드 직전 meta.snapshot에 전체 JSON을 저장하는 훅을 넣어.
서버 백업이 없으므로 마이그레이션 실패는 영구 소실이다.
```

---

## 7. 도메인 엔진

```
src/lib/domain/에 순수 함수 4개 모듈을 만들어 줘. DB를 직접 읽지 말고
전부 인자로 받아. 테스트 가능해야 한다.

cycle.ts
  cycleRange(now: Date, startDay: number): { start, end }
  startDay가 29~31이고 해당 월에 없으면 말일로 보정.
  daysLeft(now, range): number

performance.ts
  isExcluded(txn, card): boolean
    우선순위: txn.excludedManual → card.excludes → DEFAULT_EXCLUDE
  computePerformance(card, txns, range): Performance
    반환: sum, excluded, cur, next, top, progress, overflow, benefit, nextGain

optimize.ts
  optimize(cards, txns, range, now): { actions, target }
  TRD.md 5.3절 알고리즘을 그대로 구현.
  reachable 판정 계수 0.8은 상수로 분리해 이름을 붙여.
  action.type은 'over' | 'fill-need' | 'ok'.
  초과 조치를 최상단, 그다음 예상 이득 내림차순 정렬.

analytics.ts
  monthlyTrend(txns, months): 최근 N개월 합계
  categoryBreakdown(txns, range): 업종별 합계 내림차순
  yearlyOutlook(cards, actions): { now, optimized, gain }

모든 금액은 원 단위 정수. 적립 계산은 Math.floor로 절사.
```

---

## 8. 도메인 테스트

```
src/lib/domain/__tests__/에 테스트를 작성해 줘.

경계 케이스를 반드시 포함:
- 실적이 구간 경계에 정확히 일치할 때 (min === sum)
- 취소 거래로 실적이 구간 아래로 내려갈 때
- tiers가 빈 배열인 무실적 카드
- 주기 시작일이 31일이고 2월인 경우
- 모든 카드가 최고 구간을 넘겼을 때 (대체 카드 없음)
- 거래가 0건일 때
- cardId가 null인 거래가 섞여 있을 때 (실적에서 빠져야 함)
- 남은 날이 0일 때 (0으로 나누지 않아야 함)

커버리지 90% 이상을 목표로 하고, 미달이면 어떤 분기가 비었는지 알려 줘.
```

---

## 9. 디자인 시스템

```
src/components/ui/에 기본 컴포넌트를 만들어 줘.
shadcn/ui를 쓰되 토큰을 프로젝트 값으로 덮어써.

만들 것: Button(default/ghost/hl/go 4종 + sm 사이즈), Sheet(하단 시트),
Toggle(role="switch"), Chip(선택 토글), Toast, Field(라벨+입력 조합)

품질 기준:
- 최소 터치 타깃 44×44px
- :focus-visible 아웃라인 2px var(--blue)
- prefers-reduced-motion에서 전환 제거
- 형광색(--hl)은 배경으로만 쓰고 그 위 텍스트는 항상 --ink

Money 컴포넌트도 만들어: 원 단위 정수를 받아 toLocaleString('ko-KR')로
표시하고 font-variant-numeric: tabular-nums 적용.
전 화면의 금액 표시는 반드시 이 컴포넌트를 거치게 해.
```

---

## 10. 시그니처 컴포넌트 — CardGauge ★

```
src/components/dashboard/CardGauge.tsx를 만들어 줘.
이 앱에서 가장 중요한 UI다. 여기에 공을 들여.

콘셉트: 카드가 곧 게이지다.
- 플라스틱 카드 비율의 컨테이너 (border-radius 14px, 1px 테두리)
- 실적 진행률만큼 왼쪽부터 배경이 차오른다
- 실적 구간이 카드 위에 세로 눈금선으로 새겨지고, 눈금 아래 작은 등폭 라벨
- 그 위에 카드명, 뒷자리, 실적 금액(큰 등폭), 상태 문구가 얹힌다

상태 3종:
- 미달: 차오름 --hl-soft, 배지 없음 또는 현재 구간 라벨
- 달성: 차오름 --go-soft, 배지 '달성'(--go)
- 초과: 차오름 --warn-soft, 배지 '초과'(--warn)

상태 문구:
- 초과: "최고 구간을 <b>N원</b> 넘겼습니다"
- 미달: "<구간명> 구간까지 <b>N원</b>"
- 달성: "모든 구간 달성"
- 제외 금액이 있으면 " · 실적 제외 N원"을 덧붙임

애니메이션: 차오름은 0.5s cubic-bezier(.2,.8,.2,1). 진입 시 0에서 시작.
탭하면 onEdit 콜백. 누르는 동안 scale(.988).

Props는 Card와 Performance를 받고, 내부에서 계산하지 마.
Storybook 없이 볼 수 있게 목 데이터 3상태 예시를 파일 하단 주석으로 남겨.
```

---

## 11. 화면 — 대시보드

```
src/app/page.tsx의 대시보드 탭과 components/dashboard/를 구현해 줘.

구성 (위에서부터):
1. HeroPick — 다크(--ink) 배경 카드.
   "지금 이 카드로" 라벨(--hl, 자간 넓게) + 권장 카드명(26px, 800)
   + 이유 한 줄 + 하단 3열 통계(이번 주기 실적 / 확보한 혜택 / 남은 날)
   우하단에 회전한 카드 실루엣 장식 1개.
2. CardGauge 목록
3. 최근 결제 6건

권장 카드 선정: optimize()의 target. 초과 카드가 있으면 이유 문구를
"○○카드는 최고 구간을 넘겼습니다. 이제 여기로 옮기세요."로.

빈 상태: 카드가 없으면 HeroPick 대신
"카드를 등록하면 이번 주기에 어떤 카드를 써야 하는지 한 장으로 알려드립니다."
+ [템플릿에서 카드 추가] [샘플 데이터로 둘러보기] 두 버튼.
샘플 데이터는 카드 3장 + 거래 29건으로 가치를 30초 안에 보여줘야 한다.

상단 고정 바에 현재 주기와 D-N을 표시.
하단에 "모든 계산은 이 기기 안에서만 이뤄집니다" 한 줄.
```

---

## 12. 화면 — 내 카드

```
components/cards/를 구현해 줘.

CardList: 카드별 박스. 이름·뒷자리·편집 버튼, 실적 수평 바,
실적 구간/연회비/주요 적립/실적 제외를 한 줄씩.

CardEditor (하단 시트):
- 카드사 select, 뒷 4자리 input(숫자 4자리 제한)
- 카드 이름, 연회비
- 실적 구간: 라벨/기준액/혜택 3열 입력을 행 단위로 추가·삭제
- 실적 제외 업종: 15개 업종 칩 토글
- 업종별 적립률: 2열 그리드로 % 입력
- 저장 / 삭제

저장 시:
- tiers는 min>0인 것만 남기고 오름차순 정렬
- 라벨이 비면 기준액을 "30만" 형태로 자동 생성
- 저장 직후 cardId가 null인 기존 거래를 전부 재매칭 (소급 매칭)

PresetPicker: 구간 형태 5종(3구간형/2구간형/단일/고액/무실적).
각 템플릿 아래에 "여기 숫자는 형태를 보여주는 예시입니다.
실제 조건은 카드사 홈페이지·앱의 상품 안내를 확인해 입력하세요"를 반드시 노출.
```

---

## 13. 화면 — 문자분석

```
components/sms/를 구현해 줘.

CollectSettings: 토글 3개
- 공유 시트로 받기: "문자 앱에서 공유 → 실적ON을 선택하면 자동으로 분석합니다"
- 붙여넣기 자동 감지: "앱으로 돌아올 때 클립보드에 결제 문자가 있으면 바로 물어봅니다"
- 중복 결제 건너뛰기: "같은 카드·금액·시각이 이미 있으면 저장하지 않습니다"

ParseStats: 분석 시도 / 인식 성공 / 정확도 3열.

Ingest: textarea + [분석해서 저장] [붙여넣기].
여러 건은 빈 줄로 구분해 일괄 처리. 결과를 토스트로
"N건 저장 · M건 미인식 · K건 중복".

Unrecognized: 실패 사유를 --warn 색으로 먼저 보여주고 원문 180자,
[직접 입력] [삭제]. 직접 입력 시트에서 카드/금액/날짜/가맹점/업종을 받고,
가맹점 입력 중 실시간으로 업종을 자동 선택.

TxnList: 최근 40건. 탭하면 편집 시트 —
카드 지정, 업종, 실적 반영(업종 규칙에 맡기기/포함/제외 3택),
원문 보기(details), 저장, 삭제.

미인식 문자를 절대 조용히 버리지 마. 실패도 화면에 남아야 한다.
```

---

## 14. 화면 — 최적화

```
components/optimize/를 구현해 줘.

상단 요약: 다크 배경 박스. "이번 주기 조치로 얻을 수 있는 금액" 라벨(--hl) +
합계(30px, 800) + "남은 N일 안에 아래 순서대로 옮기면 됩니다".

ActionList: 조치마다 왼쪽 3px 세로선으로 유형을 구분
(over=--warn, fill-need=--hl, ok=--line).
제목 + 본문 + 예상 이득 배지(형광 배경).

문구는 PRD.md 5.4절 예시의 톤을 따라. 구체적인 금액과 카드명을 반드시 포함.
도달이 어려운 카드에는 "무리라면 이번 주기는 접고 다른 카드에 집중하세요"를 넣어.
이 문장을 빼지 마. 실적 채우려 과소비하게 만드는 앱이 되면 안 된다.

CategoryBest: 15개 업종 × 최고 적립률 카드. 등록된 조건이 없으면 '—'.
하단에 "적립률은 내 카드 화면에서 직접 입력한 값으로 계산합니다" 안내.
```

---

## 15. 화면 — 분석

```
components/stats/를 구현해 줘. 차트 라이브러리를 쓰지 말고 CSS로 그려.

MonthlyBars: 최근 6개월 막대. flex + height %. 이번 달만 --hl 색.
막대 아래 월 라벨(등폭). 하단에 이번 달 합계.

CategoryBars: 이번 주기 업종별. 수평 바.
라벨에 아이콘 + 업종명 + "· ○○카드 추천", 우측에 금액과 비율 %.
금액 내림차순.

YearlyOutlook: 3행 리스트
- 지금 방식 그대로 (연회비 차감 후)
- 최적화 조치를 따랐을 때 (--go 색)
- 연간 추가 확보액 (차액, --go 색)

하단에 "예측은 입력한 혜택 금액과 이번 주기 사용 패턴이 유지된다고
가정한 값입니다" 고지를 반드시 넣어. 절감액을 확정된 사실처럼 보이게 하지 마.
```

---

## 16. PWA 구성

```
PWA를 구성해 줘.

public/manifest.json:
name "실적ON — 신용카드 실적 관리", short_name "실적ON",
display standalone, orientation portrait,
background_color #E9ECF1, theme_color #101B2D,
아이콘 192/512 (maskable 포함),
share_target을 GET 방식으로 선언 (action './', params text/title/url)

public/sw.js:
앱 셸 캐시 우선. 활성화 시 구버전 캐시 삭제.
★ fetch 핸들러에서 쿼리에 text 또는 title이 있으면
캐시된 index로 응답해야 한다. 그러지 않으면 오프라인에서 공유가 실패한다.

src/lib/share/shareTarget.ts:
부팅 시 location.search의 text를 읽어 ingest 파이프라인에 넣고,
처리 후 history.replaceState로 쿼리 제거.
브라우저 히스토리에 결제 정보가 남으면 안 된다.

src/lib/share/clipboard.ts:
visibilitychange에서 설정이 켜져 있을 때만 readText() 시도.
직전 텍스트를 메모리 캐시해 중복 팝업 방지.
실패는 조용히 무시 (Safari는 거부한다).
파싱 성공한 경우에만 저장 여부를 묻고, 실패한 텍스트는 즉시 폐기.
```

---

## 17. 백업

```
src/lib/db/backup.ts와 설정 화면을 만들어 줘.

exportAll(): ERD.md 7절 포맷으로 JSON 직렬화 → Blob → 다운로드.
파일명 siljeokon-backup-YYYYMMDD.json.
내보내기 직전에 "이 파일에는 카드 뒷자리와 결제 내역이 그대로 들어갑니다.
안전한 곳에 보관하세요"를 확인시켜.

importAll(file): app 필드 확인 → schemaVersion 확인 →
병합/덮어쓰기 선택 → 병합 시 거래는 중복 판정 키로 필터.

meta.lastBackupAt을 기록하고, 30일 경과 시 대시보드에 안내 배너.

전체 삭제 버튼도 만들어. 되돌릴 수 없다는 경고를 2단계로.
```

---

## 18. 보안 점검

```
보안을 점검하고 고쳐 줘.

1. next.config.js에 CSP 헤더 추가.
   connect-src는 'self'만 허용한다. 이 앱은 외부로 요청을 보내지 않고,
   그것을 CSP로 강제해야 한다.
2. 전 코드에서 dangerouslySetInnerHTML 사용처를 찾아 제거.
   문자 원문과 가맹점명은 반드시 텍스트 노드로 렌더.
3. 외부 스크립트, 애널리틱스, 폰트 CDN 의존을 찾아 제거하거나 self-host로 전환.
4. 에러 바운더리에서 스택 트레이스에 결제 정보가 실리지 않는지 확인.
5. 진단 정보 복사 기능이 있다면 금액·가맹점을 마스킹하는지 확인.

각 항목의 점검 결과를 표로 정리하고, 고친 부분을 알려 줘.
```

---

## 19. 성능 최적화

```
성능을 점검해 줘. TRD.md 8절 목표 대비 현재 수치를 측정하고,
미달 항목을 개선해.

특히:
- 실적 계산 메모이제이션. 무효화 키는
  (cycleStart, txns.length, 마지막 거래 id, cards 해시)
- 거래 5,000건 상황을 시드로 만들어 재계산 시간 측정
- 번들 분석 후 180KB(gzip) 초과 시 원인 제거
- 문자 50건 일괄 처리 500ms 이내 확인

측정 → 개선 → 재측정 순서로 진행하고, 각 단계 수치를 남겨.
추측으로 최적화하지 마.
```

---

## 20. 접근성 · 마무리 점검

```
출시 전 최종 점검을 해 줘.

접근성:
- 대비비 WCAG AA 검사. 형광 노랑 배경 위 텍스트 특히 확인
- 모든 인터랙티브 요소 focus-visible
- 토글에 role="switch" + aria-checked
- 스크린리더로 금액이 자연스럽게 읽히는지 (aria-label에 "원" 포함)
- prefers-reduced-motion 동작 확인

기능:
- 주기 경계를 넘길 때 실적이 올바르게 리셋되는지 (시스템 시각 조작 테스트)
- 카드 삭제 후 거래가 보존되는지
- 오프라인에서 전 기능 동작하는지
- 공유 시트가 오프라인에서도 동작하는지

카피:
- 전 화면 문구가 사용자 언어인지 (시스템 용어 금지)
- 버튼 문구와 결과 토스트의 동사가 일치하는지 ("저장" → "저장했습니다")
- 절감액을 확정된 사실처럼 표현한 곳이 없는지

각 항목을 표로 정리하고 미통과 항목만 고쳐 줘.
```

---

## 부록 A. 파서 규칙 추가 프롬프트 (운영 중 사용)

```
카드사 문자 형식이 바뀌어 파싱이 실패하고 있어. 아래는 실패한 원문이야.

[원문 붙여넣기 — 이름과 카드번호는 마스킹할 것]

실패 사유: [앱이 표시한 사유]

요청:
1. 왜 실패했는지 파이프라인 단계별로 진단해 줘
2. rules.ts 또는 parser/index.ts에서 고쳐야 할 최소 변경을 제안해 줘
3. 이 형식을 골든 케이스로 테스트에 추가해 줘
4. 기존 40건 테스트가 전부 통과하는지 확인해 줘

기존 테스트를 느슨하게 고치는 방식으로 통과시키지 마.
```

## 부록 B. 카드 조건 검증 프롬프트

```
아래 카드사 상품 안내 텍스트를 읽고, 실적ON의 카드 등록 형식으로 정리해 줘.

[카드사 홈페이지 상품 안내 붙여넣기]

정리할 항목:
- 실적 구간: 라벨 / 기준액 / 그 구간의 월 예상 혜택
- 연회비
- 실적 제외 업종 (실적ON의 15개 업종으로 매핑)
- 업종별 적립률과 월 한도

원문에 없는 값은 추측하지 말고 "안내에 없음"으로 표시해.
혜택 금액이 "최대 N원"으로만 적혀 있으면 그 사실을 그대로 알려 줘.
```
