/* 실적ON 서비스워커 — 오프라인 우선(앱 셸 캐시). Next.js 라우팅에 맞춰 '/'를 셸로 캐시한다. */
const CACHE = 'siljeokon-v2';
const SHELL = ['/', '/guide', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 공유 시트로 들어온 요청(?text= 또는 ?title=)은 캐시된 셸로 응답하고 쿼리는 앱이 처리한다.
  // 그러지 않으면 오프라인에서 공유가 실패한다.
  if (url.searchParams.has('text') || url.searchParams.has('title')) {
    e.respondWith(caches.match('/').then((r) => r || fetch('/')));
    return;
  }

  // 문서 요청은 네트워크 우선(최신 셸), 실패 시 요청 경로 캐시 → 앱 셸 순으로 폴백
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // 그 외 정적 자산은 캐시 우선, 미스 시 네트워크 후 캐시에 저장
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit),
    ),
  );
});
