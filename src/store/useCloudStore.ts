import { create } from 'zustand';
import { isFirebaseConfigured, isInboxConfigured } from '@/lib/firebase/config';
import { ensureInboxToken, subscribeInbox } from '@/lib/firebase/inbox';
import type { AuthUser } from '@/lib/firebase/auth';
import { buildBackup } from '@/lib/db/backup';
import { encryptString, decryptString, isEncrypted } from '@/lib/crypto';
import { getLastCloudBackupAt, setLastCloudBackupAt } from '@/lib/db/schema';
import { useAppStore } from './useAppStore';
import type { ImportMode, ImportResult } from '@/lib/db/backup';

const CLOUD_ENABLED_KEY = 'siljeokon.cloudEnabled';

function cloudEnabledFlag(): boolean {
  try {
    return localStorage.getItem(CLOUD_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}
function setCloudEnabledFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(CLOUD_ENABLED_KEY, '1');
    else localStorage.removeItem(CLOUD_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

interface CloudState {
  available: boolean;
  ready: boolean;
  user: AuthUser | null;
  busy: boolean;
  lastCloudBackupAt: number | null;
  /** 문자 자동 수신함 사용 가능 여부(RTDB 설정됨) */
  inboxAvailable: boolean;
  /** 이 사용자의 수신 토큰(자동화 웹훅 URL에 들어감) */
  inboxToken: string | null;
  /** 이번 세션에서 입력한 비밀번호(메모리 전용, 저장하지 않음) */
  sessionPassphrase: string | null;

  init: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  backupNow: (passphrase?: string) => Promise<void>;
  restore: (mode: ImportMode, passphrase?: string) => Promise<ImportResult>;
  hasCloudBackup: () => Promise<boolean>;
}

let unsub: (() => void) | null = null;
let inboxUnsub: (() => void) | null = null;

/** 로그인된 사용자의 수신함을 구독해 들어오는 문자를 자동 저장한다. */
async function setupInbox(userUid: string): Promise<void> {
  if (!isInboxConfigured()) return;
  try {
    const token = await ensureInboxToken(userUid);
    useCloudStore.setState({ inboxToken: token });
    if (inboxUnsub) {
      inboxUnsub();
      inboxUnsub = null;
    }
    inboxUnsub = await subscribeInbox(userUid, async (text) => {
      await useAppStore.getState().ingest(text);
    });
  } catch {
    /* RTDB 미설정/권한 등 — 수신함 없이 계속 동작 */
  }
}

function teardownInbox(): void {
  if (inboxUnsub) {
    inboxUnsub();
    inboxUnsub = null;
  }
  useCloudStore.setState({ inboxToken: null });
}

/** 인증 상태 변화 공통 처리: 상태 반영 + 수신함 연결/해제 */
function onAuthUser(user: AuthUser | null): void {
  useCloudStore.setState({ user });
  if (user) void setupInbox(user.uid);
  else teardownInbox();
}

export const useCloudStore = create<CloudState>((set, get) => ({
  available: isFirebaseConfigured(),
  ready: false,
  user: null,
  busy: false,
  lastCloudBackupAt: null,
  inboxAvailable: isInboxConfigured(),
  inboxToken: null,
  sessionPassphrase: null,

  async init() {
    if (!get().available) {
      set({ ready: true });
      return;
    }
    const last = await getLastCloudBackupAt();
    set({ lastCloudBackupAt: last });
    // 이전에 클라우드를 켠 사용자만 자동으로 세션을 복원한다(그 외엔 외부 요청 0건 유지).
    if (cloudEnabledFlag() && !unsub) {
      const { subscribeAuth } = await import('@/lib/firebase/auth');
      unsub = await subscribeAuth(onAuthUser);
    }
    set({ ready: true });
  },

  async signIn() {
    if (!get().available) throw new Error('Firebase가 설정되지 않았습니다.');
    set({ busy: true });
    try {
      const { signInWithGoogle, subscribeAuth } = await import('@/lib/firebase/auth');
      const user = await signInWithGoogle();
      setCloudEnabledFlag(true);
      if (!unsub) unsub = await subscribeAuth(onAuthUser);
      onAuthUser(user);
    } finally {
      set({ busy: false });
    }
  },

  async signOut() {
    set({ busy: true });
    try {
      const { signOutUser } = await import('@/lib/firebase/auth');
      await signOutUser();
      setCloudEnabledFlag(false);
      if (unsub) {
        unsub();
        unsub = null;
      }
      teardownInbox();
      set({ user: null, sessionPassphrase: null });
    } finally {
      set({ busy: false });
    }
  },

  async backupNow(passphrase) {
    const user = get().user;
    if (!user) throw new Error('먼저 로그인하세요.');
    set({ busy: true });
    try {
      const pass = passphrase || get().sessionPassphrase || '';
      const json = JSON.stringify(await buildBackup());
      const content = pass ? await encryptString(json, pass) : json;
      const { uploadBackup } = await import('@/lib/firebase/cloudBackup');
      await uploadBackup(user.uid, content);
      const at = Date.now();
      await setLastCloudBackupAt(at);
      set({ lastCloudBackupAt: at });
      if (passphrase) set({ sessionPassphrase: passphrase });
    } finally {
      set({ busy: false });
    }
  },

  async restore(mode, passphrase) {
    const user = get().user;
    if (!user) throw new Error('먼저 로그인하세요.');
    set({ busy: true });
    try {
      const { downloadBackup } = await import('@/lib/firebase/cloudBackup');
      const content = await downloadBackup(user.uid);
      if (content == null) throw new Error('클라우드에 백업이 없습니다.');
      let json: string;
      if (isEncrypted(content)) {
        if (!passphrase) throw new Error('암호화된 백업입니다. 비밀번호를 입력하세요.');
        json = await decryptString(content, passphrase);
        set({ sessionPassphrase: passphrase });
      } else {
        json = content;
      }
      const parsed = JSON.parse(json);
      const result = await useAppStore.getState().importBackup(parsed, mode);
      return result;
    } finally {
      set({ busy: false });
    }
  },

  async hasCloudBackup() {
    const user = get().user;
    if (!user) return false;
    const { cloudMeta } = await import('@/lib/firebase/cloudBackup');
    return (await cloudMeta(user.uid)).exists;
  },
}));
