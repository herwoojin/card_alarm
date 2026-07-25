import type { Metadata } from 'next';
import { AppBackground } from '@/components/AppBackground';

export const metadata: Metadata = {
  title: '아주 쉽게 보는 사용법 · 실적ON',
  description: '실적ON을 처음 쓰는 분을 위한 아주 쉬운 사용법 — 카드 등록부터 결제 문자 넣기, 화면 읽는 법까지',
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="box" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30, height: 30, flex: 'none', borderRadius: 9, background: 'var(--ink)', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15,
          }}
        >
          {n}
        </span>
        <b style={{ fontSize: 16, letterSpacing: '-.03em' }}>{title}</b>
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 4, background: color, marginRight: 7, verticalAlign: 'middle' }}
    />
  );
}

export default function GuidePage() {
  return (
    <main className="wrap" style={{ paddingTop: 18, paddingBottom: 40 }}>
      <AppBackground />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span className="dot" aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--hl)', boxShadow: '0 0 0 3px rgba(242,225,75,.28)' }} />
        <b style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.04em' }}>실적ON</b>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.045em', margin: '10px 0 4px' }}>아주 쉽게 보는 사용법</h1>
      <p style={{ color: 'var(--mute)', fontSize: 13.5, margin: '0 0 6px', lineHeight: 1.6 }}>
        카드 실적을 문자로 자동 추적하고, 넘친 순간 어떤 카드로 옮길지 한 장으로 알려줍니다.
        아래 순서만 따라 하면 됩니다.
      </p>
      <p className="note" style={{ marginTop: 0 }}>이 앱은 회원가입이 없고, 모든 기록은 이 기기 안에만 저장됩니다. 카드번호 전체·비밀번호는 절대 묻지 않습니다.</p>

      <div className="sec">따라 하기</div>

      <Step n={1} title="내 카드 등록하기">
        아래쪽 <b>💳 내 카드</b> 탭 → <b>[템플릿에서 고르기]</b>를 누릅니다.
        <br />내 카드와 비슷한 형태(예: 3구간형)를 고른 뒤, <b>카드사 앱·홈페이지의 실제 조건</b>을 보고 숫자를 고쳐 주세요.
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          <li><b>카드 뒷 4자리</b>를 꼭 넣으세요. 문자가 자동으로 이 카드에 붙습니다.</li>
          <li><b>실적 구간</b>의 <b>혜택 금액</b>이 중요합니다. “조치하면 얼마 더 버는지”를 이 값으로 계산합니다.</li>
        </ul>
        <p className="note" style={{ marginTop: 8 }}>템플릿의 숫자는 형태를 보여주는 예시입니다. 실제 값은 반드시 직접 확인해 입력하세요.</p>
      </Step>

      <Step n={2} title="결제 문자 넣기">
        <b>📩 문자분석</b> 탭에서 세 가지 방법 중 편한 걸 쓰면 됩니다.
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          <li><b>공유하기(안드로이드)</b> — 문자 앱에서 결제 문자 길게 누르기 → 공유 → 실적ON 선택</li>
          <li><b>붙여넣기</b> — 문자 복사 후 입력창에 붙여넣고 <b>[분석해서 저장]</b></li>
          <li><b>한꺼번에</b> — 여러 문자를 <b>빈 줄로 구분</b>해 붙여넣으면 한 번에 처리</li>
        </ul>
        <div className="num" style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', marginTop: 10, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--ink-2)' }}>
{`[Web발신]
신한카드(1234)승인 홍*동
12,000원 일시불
07/24 14:23 스타벅스 강남점`}
        </div>
        <p className="note" style={{ marginTop: 8 }}>못 읽은 문자는 버려지지 않고 “미인식 문자”에 남습니다. [직접 입력]으로 채우면 실적에 반영됩니다.</p>
      </Step>

      <Step n={3} title="게이지 색으로 상태 읽기">
        <b>📊 대시보드</b>의 카드 게이지 색이 지금 상태입니다.
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 6 }}><Dot color="var(--hl)" /><b>노랑 · 미달</b> — 다음 구간까지 남은 금액을 알려줍니다. 조금 더 쓰면 혜택이 열립니다.</div>
          <div style={{ marginBottom: 6 }}><Dot color="var(--go)" /><b>초록 · 달성</b> — 구간을 다 채웠습니다. 그대로 두세요.</div>
          <div><Dot color="var(--warn)" /><b>빨강 · 초과</b> — 최고 구간을 넘겼습니다. <b>지금 멈추고 다른 카드로 옮기세요.</b></div>
        </div>
      </Step>

      <Step n={4} title="지금 쓸 카드로 결제하기">
        맨 위 검은 카드에 <b>지금 써야 할 카드 한 장</b>이 크게 뜹니다.
        <br /><b>[이 카드로 결제 · ○○ 앱 열기]</b>를 누르면 해당 카드사 앱이 열립니다.
        <br /><b>🎯 최적화</b> 탭에서는 “○○카드는 넘쳤으니 △△카드로 옮기세요” 같은 구체적인 순서를 알려줍니다.
        <p className="note" style={{ marginTop: 8 }}>결제는 카드사 앱에서 진행됩니다. 실적ON은 카드번호를 만들지도, 저장하지도 않습니다.</p>
      </Step>

      <Step n={5} title="가끔 백업하기">
        기록은 이 기기에만 있어서, 브라우저 데이터를 지우면 사라집니다.
        <br />우측 상단 <b>[설정]</b> → <b>[백업 내보내기]</b>로 한 달에 한 번쯤 파일로 저장해 두세요.
        <br />기기를 바꾸면 <b>[백업 가져오기]</b>로 그대로 복구할 수 있습니다.
      </Step>

      <div className="sec">기억할 점</div>
      <div className="box">
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.75 }}>
          <div>· 모든 계산과 저장은 <b>이 기기 안에서만</b> 이뤄집니다.</div>
          <div>· 카드사 혜택 조건이 바뀌면 <b>[내 카드]</b>에서 직접 고쳐 주세요.</div>
          <div>· 실적을 채우려고 <b>무리해서 쓰지 마세요.</b> 앱이 “이번 달은 접으세요”라고 하면 그게 맞는 답입니다.</div>
          <div>· 최종 실적·혜택은 카드사 명세서가 기준입니다. 이 앱은 미리 알기 위한 도구입니다.</div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <a className="btn" href="/" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          실적ON 시작하기
        </a>
      </div>
    </main>
  );
}
