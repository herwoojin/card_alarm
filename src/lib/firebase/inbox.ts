import { getFirebaseApp } from './client';
import { isInboxConfigured } from './config';
import { uid as genId } from '@/lib/id';

/** 수신함(RTDB) 사용 가능 여부 = databaseURL 설정됨. */
export { isInboxConfigured };

async function getDb() {
  const app = await getFirebaseApp();
  const { getDatabase } = await import('firebase/database');
  return getDatabase(app);
}

/**
 * 사용자 수신 토큰 확보. 없으면 생성하고 tokenOwners에 등록한다(웹훅이 token→uid 조회).
 * 토큰은 사용자당 고정이라 자동화 URL이 바뀌지 않는다.
 */
export async function ensureInboxToken(userUid: string): Promise<string> {
  const db = await getDb();
  const { ref, get, set } = await import('firebase/database');
  const snap = await get(ref(db, `users/${userUid}/inboxToken`));
  let token: string | null = snap.val();
  if (!token) {
    token = (genId() + genId()).replace(/[^a-z0-9]/gi, '');
    await set(ref(db, `users/${userUid}/inboxToken`), token);
    await set(ref(db, `tokenOwners/${token}`), userUid);
  }
  return token;
}

/**
 * 수신함 구독. 새 항목마다 onItem(text)로 넘긴 뒤 해당 항목을 삭제한다.
 * 열려 있으면 실시간, 닫혀 있었으면 다음에 열 때 밀린 항목을 한꺼번에 처리한다.
 * 반환값을 호출하면 구독 해제.
 */
export async function subscribeInbox(userUid: string, onItem: (text: string) => Promise<void>): Promise<() => void> {
  const db = await getDb();
  const { ref, onChildAdded, remove } = await import('firebase/database');
  const inboxRef = ref(db, `inbox/${userUid}`);
  const off = onChildAdded(inboxRef, async (snap) => {
    const val = snap.val() as { text?: unknown } | null;
    const text = val && typeof val.text === 'string' ? val.text : null;
    try {
      if (text) await onItem(text);
    } finally {
      try {
        await remove(snap.ref);
      } catch {
        /* ignore */
      }
    }
  });
  return off;
}
