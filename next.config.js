/** @type {import('next').NextConfig} */

// 전 페이지 CSR + 서버 로직 없음 → 정적 내보내기(out/). Netlify가 out/를 그대로 서빙한다.
// 보안 헤더·CSP는 정적 호스팅에서 적용되어야 하므로 public/_headers(→ out/_headers)에서 관리한다.
// (정적 export에는 next.config의 headers()가 적용되지 않는다.)
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
