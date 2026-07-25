import type { User } from 'firebase/auth';
import { getFirebaseApp, getFirebaseAuth } from './client';

export type { User };

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL };
}

/** 구글 팝업 로그인. 세션은 브라우저에 로컬 지속(설치형/재방문 시 유지). */
export async function signInWithGoogle(): Promise<AuthUser> {
  const auth = await getFirebaseAuth();
  const { GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } = await import('firebase/auth');
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return toAuthUser(cred.user)!;
}

export async function signOutUser(): Promise<void> {
  const auth = await getFirebaseAuth();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/** 인증 상태 구독. 초기화도 겸한다(재방문 로그인 복원). */
export async function subscribeAuth(cb: (user: AuthUser | null) => void): Promise<() => void> {
  // getFirebaseApp을 먼저 호출해 초기화 순서를 보장
  await getFirebaseApp();
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (u) => cb(toAuthUser(u)));
}
