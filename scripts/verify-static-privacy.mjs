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
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; " +
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
    if (!existsSync(file)) {
      // 정적 export: 알 수 없는 경로는 index.html 로 폴백(클라이언트 탭 처리)
      file = path.join(ROOT, 'index.html');
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

  // 모든 화면을 훑는다: 샘플 로드 → 각 탭
  await page.getByRole('button', { name: '샘플 데이터로 둘러보기' }).click();
  await page.getByText('지금 이 카드로').waitFor();
  for (const tab of ['내 카드', '문자분석', '최적화', '분석', '대시보드']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(250);
  }
  // 설정 시트도 열어본다(백업 UI 등)
  await page.getByRole('button', { name: '설정', exact: true }).click();
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
