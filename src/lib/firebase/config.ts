/**
 * Firebase 설정. (선택 기능 — 구글 로그인 + 클라우드 백업)
 *
 * 웹 Firebase 설정값은 비밀이 아니다(모든 클라이언트 번들에 노출됨). 실제 보안은
 * Storage 보안 규칙(storage.rules)과 승인된 도메인, 그리고 사용자별 UID 격리가 담당한다.
 * 그래서 기본값을 코드에 두고, 필요하면 NEXT_PUBLIC_FIREBASE_* 환경변수로 덮어쓴다.
 *
 * 클라우드 기능은 완전 옵트인이다. 사용자가 "구글 로그인"을 누르기 전에는
 * Firebase가 초기화되지도, 어떤 외부 요청도 보내지 않는다.
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const DEFAULTS: FirebaseConfig = {
  apiKey: 'AIzaSyCfYrEgji-YBDwx-qbcmuSColugsrbj4hA',
  authDomain: 'card-alarm-service.firebaseapp.com',
  projectId: 'card-alarm-service',
  storageBucket: 'card-alarm-service.firebasestorage.app',
  messagingSenderId: '1037642779249',
  appId: '1:1037642779249:web:dcc7529fbc8c6edab2e9d0',
};

export function readFirebaseConfig(): FirebaseConfig | null {
  const cfg: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULTS.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULTS.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULTS.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULTS.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULTS.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULTS.appId,
  };
  // 필수 필드가 하나라도 비면 미설정으로 간주한다(= 로컬 전용 모드).
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.storageBucket || !cfg.appId) return null;
  return cfg;
}

/** Firebase 설정이 존재하는가(클라우드 기능 노출 여부). */
export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}
