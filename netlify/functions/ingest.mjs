/**
 * 실적ON 무료 수신 웹훅 (Netlify Function, 무료 티어).
 *
 * 폰 자동화(단축어/MacroDroid/Tasker) 또는 Make/Zapier/n8n 가 아래로 호출:
 *   GET  /.netlify/functions/ingest?token=<TOKEN>&text=<URL인코딩된 문자>
 *   POST /.netlify/functions/ingest   (JSON {token,text} 또는 폼 token,text)
 *
 * 구현: 서비스 계정 키(조직 정책으로 막힐 수 있음) 대신 **RTDB 데이터베이스 시크릿**으로
 * REST 호출한다. 별도 SDK 없이 fetch만 사용 → 콜드스타트도 빠르다.
 * token → uid 를 RTDB(tokenOwners)에서 찾아, 그 사용자 수신함(inbox/{uid})에 문자를 쌓는다.
 * 앱은 로그인 상태에서 이 수신함을 실시간 구독해 저장하고 비운다.
 *
 * 필요한 Netlify 환경변수(둘 다 시크릿):
 *   FIREBASE_DB_URL    = Realtime Database URL (예: https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app)
 *   FIREBASE_DB_SECRET = Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 데이터베이스 비밀번호(Secret)
 */
const DB = (process.env.FIREBASE_DB_URL || '').replace(/\/+$/, '');
const SECRET = process.env.FIREBASE_DB_SECRET || '';

/** RTDB 경로에 안전한 문자만 남긴다(경로 주입 방지). */
function safeSeg(v) {
  return String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
}

async function rtdbGet(path) {
  const res = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(SECRET)}`);
  if (!res.ok) throw new Error('rtdb get ' + res.status);
  return res.json();
}

async function rtdbPush(path, data) {
  const res = await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(SECRET)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('rtdb push ' + res.status);
  return res.json();
}

async function readParams(req) {
  const url = new URL(req.url);
  let token = url.searchParams.get('token');
  let text = url.searchParams.get('text');
  if ((!token || !text) && req.method === 'POST') {
    const ct = req.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) {
        const body = await req.json();
        token = token || body.token;
        text = text || body.text;
      } else {
        const form = await req.formData();
        token = token || form.get('token');
        text = text || form.get('text');
      }
    } catch {
      /* ignore parse errors */
    }
  }
  return { token: token && String(token), text: text && String(text) };
}

export default async (req) => {
  if (!DB || !SECRET) return new Response('server not configured', { status: 503 });
  const { token, text } = await readParams(req);
  if (!token || !text) return new Response('missing token or text', { status: 400 });
  if (text.length > 4000) return new Response('text too long', { status: 413 });

  const t = safeSeg(token);
  if (!t) return new Response('invalid token', { status: 403 });

  try {
    const uid = await rtdbGet(`tokenOwners/${t}`);
    if (!uid || typeof uid !== 'string') return new Response('invalid token', { status: 403 });

    await rtdbPush(`inbox/${safeSeg(uid)}`, { text, at: Date.now() });

    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 20px;color:#101B2D">' +
          '<div style="font-size:44px">✅</div><h1 style="font-size:20px">실적ON에 문자를 전달했습니다</h1>' +
          '<p style="color:#8590A3">앱을 열면 자동으로 반영됩니다. 이 창은 닫아도 됩니다.</p></body>',
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }
    return new Response('ok');
  } catch {
    return new Response('error', { status: 500 });
  }
};
