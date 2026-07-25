/**
 * 정적 배포 프라이버시 점검 (PLAN 출시 기준 #5: 외부 네트워크 요청 0건).
 *
 * out/ 를 프로덕션 CSP(_headers와 동일)로 서빙한 뒤, 모든 화면을 훑으며
 *  - 외부(비-localhost) 네트워크 요청이 0건인지
 *  - CSP 위반이 0건인지
 * 를 확인한다. 하나라도 걸리면 비정상 종료(exit 1).
 *
 * 사용: node scripts/verify-static-privacy.mjs   (먼저 `npm run build`로 out/ 생성)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.resolve('out');
const PORT = 3400;
const ORIGIN = `http://localhost:${PORT}`;

// public/_headers 의 프로덕션 CSP와 동일하게 유지한다.
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data: https://*.googleusercontent.com https://ssl.gstatic.com https://www.gstatic.com; " +
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://apis.google.com https://www.googleapis.com https://securetoken.googleapis.com; " +
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com; " +
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, ORIGIN);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    // Netlify pretty-URL과 동일하게: /guide → guide.html → guide/index.html 순으로 해석
    if (!existsSync(file)) {
      if (existsSync(file + '.html')) file += '.html';
      else if (existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
      else file = path.join(ROOT, 'index.html');
    }
    const body = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(body);
  } catch {
    res.writeHead(500).end();
  }
});

function run() {
  return new Promise((resolve) => server.listen(PORT, resolve));
}

const external = [];
const cspFromConsole = [];

const main = async () => {
  await run();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(e.violatedDirective + ' → ' + e.blockedURI);
    });
    // 로그인 랜딩을 건너뛰고 앱으로 진입(클라우드 미로그인 → 외부요청 0건 유지 확인)
    try {
      localStorage.setItem('siljeokon.entered', '1');
    } catch (e) {
      /* ignore */
    }
  });

  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (!u.startsWith(ORIGIN)) external.push(u);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy/i.test(m.text())) cspFromConsole.push(m.text());
  });

  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });

  // 실제 흐름으로 데이터를 채운다: 템플릿 카드 등록 → 결제 문자 1건 → 각 탭
  await page.getByRole('button', { name: '템플릿에서 카드 추가' }).click();
  await page.getByRole('button', { name: /3구간형/ }).click();
  await page.getByRole('heading', { name: '내 카드' }).waitFor();
  await page.getByRole('button', { name: '문자분석', exact: true }).click();
  await page.getByPlaceholder(/결제 문자를 붙여넣으세요/).fill('신한카드(1234) 승인 1,200,000원 일시불 스타벅스');
  await page.getByRole('button', { name: '분석해서 저장' }).click();
  await page.waitForTimeout(300);
  for (const tab of ['대시보드', '내 카드', '최적화', '분석', '대시보드']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(250);
  }
  // 설정 시트도 열어본다(백업 UI 등)
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape').catch(() => {});
  // 가이드 페이지도 점검(같은 오리진 정적 페이지)
  await page.goto(ORIGIN + '/guide', { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);

  const cspViolations = await page.evaluate(() => window.__csp || []);
  await browser.close();
  server.close();

  const allCsp = [...new Set([...cspViolations, ...cspFromConsole])];
  const ext = [...new Set(external)];

  console.log('── 정적 배포 프라이버시 점검 ──');
  console.log(`외부(비-localhost) 네트워크 요청: ${ext.length}건`);
  ext.forEach((u) => console.log('  ✗ ' + u));
  console.log(`CSP 위반: ${allCsp.length}건`);
  allCsp.forEach((v) => console.log('  ✗ ' + v));

  if (ext.length === 0 && allCsp.length === 0) {
    console.log('\n✓ 통과 — 외부 요청 0건, CSP 위반 0건 (모든 처리가 기기 안에서만 이뤄짐)');
    process.exit(0);
  } else {
    console.log('\n✗ 실패');
    process.exit(1);
  }
};

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
