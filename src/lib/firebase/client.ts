import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import { readFirebaseConfig } from './config';

/**
 * Firebase 지연 초기화. 동적 import로 SDK를 별도 청크로 분리해, 클라우드 기능을
 * 실제로 쓰기 전에는 메인 번들에 포함되지도, 네트워크로 로드되지도 않게 한다.
 */
let appPromise: Promise<FirebaseApp> | null = null;

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = (async () => {
      const cfg = readFirebaseConfig();
      if (!cfg) throw new Error('Firebase가 설정되지 않았습니다.');
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      return getApps().length ? getApp() : initializeApp(cfg);
    })();
  }
  return appPromise;
}

export async function getFirebaseAuth(): Promise<Auth> {
  const app = await getFirebaseApp();
  const { getAuth } = await import('firebase/auth');
  return getAuth(app);
}

export async function getFirebaseStorage(): Promise<FirebaseStorage> {
  const app = await getFirebaseApp();
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}
