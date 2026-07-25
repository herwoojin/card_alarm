/**
 * 실적ON 무료 수신 웹훅 (Netlify Function, 무료 티어).
 *
 * 폰 자동화(단축어/MacroDroid/Tasker) 또는 Make/Zapier/n8n 가 아래로 호출:
 *   GET  /.netlify/functions/ingest?token=<TOKEN>&text=<URL인코딩된 문자>
 *   POST /.netlify/functions/ingest   (JSON {token,text} 또는 폼 token,text)
 *
 * 유일한 쓰기 주체가 이 함수(서비스 계정)라 보안이 깔끔하다.
 * token → uid 를 RTDB(tokenOwners)에서 찾아, 그 사용자 수신함(inbox/{uid})에 문자를 쌓는다.
 * 앱은 로그인 상태에서 이 수신함을 실시간 구독해 저장하고 비운다.
 *
 * 필요한 Netlify 환경변수(둘 다 시크릿):
 *   FIREBASE_SERVICE_ACCOUNT = 서비스 계정 JSON 전체(한 줄)
 *   FIREBASE_DB_URL          = Realtime Database URL (예: https://xxx-default-rtdb.firebasedatabase.app)
 */
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getDb() {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
        databaseURL: process.env.FIREBASE_DB_URL,
      });
  return getDatabase(app);
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
  if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.FIREBASE_DB_URL) {
    return new Response('server not configured', { status: 503 });
  }
  const { token, text } = await readParams(req);
  if (!token || !text) return new Response('missing token or text', { status: 400 });
  if (text.length > 4000) return new Response('text too long', { status: 413 });

  try {
    const db = getDb();
    const ownerSnap = await db.ref('tokenOwners/' + token).get();
    const uid = ownerSnap.val();
    if (!uid || typeof uid !== 'string') return new Response('invalid token', { status: 403 });

    await db.ref('inbox/' + uid).push({ text, at: Date.now() });

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
