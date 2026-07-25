# TECH_STACK — 실적ON

> 카드 결제 문자를 파싱해 실적을 추적하고, 초과 시 대체 카드를 제안하는 기기 내 처리 PWA
> 마지막 업데이트: 2026-07-25

## 아키텍처

```
┌──────────────────── 사용자 기기(브라우저) ────────────────────┐
│                                                              │
│  수집(공유시트/클립보드/붙여넣기)                              │
│        │                                                     │
│        ▼                                                     │
│  파서(src/lib/parser)  ──▶  도메인 엔진(src/lib/domain)        │
│   규칙 기반, 순수함수         실적·최적화·분석, 순수함수         │
│        │                          │                          │
│        ▼                          ▼                          │
│  Zustand 스토어(src/store) ◀──▶ IndexedDB / Dexie(src/lib/db) │
│        │                                                     │
│        ▼                                                     │
│  UI — Next.js App Router, 전 페이지 CSR (src/app, components) │
└──────────────────────────────────────────────────────────────┘
             │ 정적 자산만 (로직·데이터 없음)
             ▼
        Vercel Edge/CDN
```

## 카테고리별 구성

| 이름 | 버전 | 용도 | 위치 | 비고 |
|---|---|---|---|---|
| Next.js | 14.2.32 | App Router, 정적 셸 + 전 페이지 CSR | `next.config.js` | CSP 헤더 포함 |
| React | 18.3 | UI 렌더링 | `src/app`, `src/components` | |
| TypeScript | 5.9 strict | 금액 계산 타입 안정성 | `tsconfig.json` | `tsc --noEmit` 통과 |
| Tailwind CSS | 3.4 | 디자인 토큰 매핑 | `tailwind.config.ts` | preflight 끔 |
| Pretendard | 1.3.9 | 가변 폰트 self-host | `src/app/fonts.ts` | next/font/local, CDN 0건 |
| Dexie | 4.x | IndexedDB 저장 계층 | `src/lib/db/schema.ts` | 복합 인덱스 `[cardId+date]` |
| Zustand | 4.5 | 인메모리 앱 상태 | `src/store/useAppStore.ts` | DB 미러 |
| SMS 파서 | — | 규칙 기반 파싱(라이브러리 없음) | `src/lib/parser/` | 카드사 13·업종 15 사전 |
| 도메인 엔진 | — | 주기·실적·최적화·분석 | `src/lib/domain/` | 순수 함수 |
| 차트 | — | CSS/SVG 직접 구현 | `src/components/stats/` | 라이브러리 미도입 |
| PWA(SW/manifest) | — | 오프라인 셸 + Web Share Target | `public/sw.js`, `public/manifest.json` | GET 공유 |
| Vitest | 2.1 | 파서 56 + 도메인 17 테스트 | `vitest.config.ts` | 73 통과 |
| Playwright | 1.62 | E2E 3시나리오 | `e2e/`, `playwright.config.ts` | export 빌드에도 통과 |
| Netlify | — | 정적 배포(GitHub 연동) | `netlify.toml`, `public/_headers` | `output: 'export'` → `out/` |

## 왜 이걸 골랐나

- **Dexie(IndexedDB)** — localStorage의 5MB 한계·동기 블로킹 회피. 거래 수천 건에서도 복합 인덱스로 주기 조회가 빠름.
- **규칙 기반 파서(ML 아님)** — 카드사 문자는 정형화돼 규칙으로 95%+ 커버되고, 실패 원인을 사람이 읽고 고칠 수 있음. 번들·배터리 절약.
- **차트 직접 구현** — 막대·수평바 수준이라 라이브러리 도입은 번들 낭비.
- **인증·서버 없음** — "결제 데이터가 기기를 벗어나지 않는다"는 유일한 차별점을 지키기 위함.

## 외부 의존 서비스 · 요금 영향

- **런타임 외부 의존성 0건.** 애널리틱스·외부 폰트·CDN·API 호출 없음(폰트도 self-host). `CSP connect-src 'self'`로 강제.
- 호스팅(**Netlify 정적**)만 비용 요소이며, 서버리스 함수·DB가 없어 무료 티어 대역폭 외 변동 비용 없음.

## 배포 (GitHub → Netlify)

1. GitHub 저장소에 푸시
2. Netlify에서 "Add new site → Import from Git"로 저장소 선택 (설정은 `netlify.toml` 자동 인식: build `npm run build`, publish `out`)
3. 배포 후 프리뷰에서 DevTools 네트워크 탭 → 외부 요청 0건, CSP 위반 0건 확인
4. `public/_headers`가 `out/_headers`로 복사되어 보안 헤더·CSP 적용

> 참고: 정적 App Router는 인라인 하이드레이션 스크립트 때문에 프로덕션 CSP가 `script-src 'self' 'unsafe-inline'`을 포함한다. 외부 스크립트 호스트는 차단되고 `connect-src 'self'`로 데이터 유출 경로가 막혀 있어, 이 앱의 핵심 방어선(외부 전송 0건)은 그대로 유지된다.

## 알려진 한계 (v1)

- 웹앱은 SMS를 직접 못 읽음 → 공유 시트/클립보드/자동화로 우회.
- 카드 조건을 사용자가 직접 입력해야 함(카드사 API 미연동).
- 실적 주기가 전역 설정 1개(카드사별 기준일 차이는 v1.1).
- 할부는 승인월 전액 반영(청구월 분할은 v1.1).
- 로컬 저장소가 유일 → 브라우저 데이터 삭제 시 복구 불가(백업 내보내기 필수).
- 백엔드 서버가 없어 서버 헬스/배터리 인디케이터는 미적용(네트워크 0 원칙과 충돌).
