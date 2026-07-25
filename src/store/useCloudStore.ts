import { create } from 'zustand';
import { isFirebaseConfigured } from '@/lib/firebase/config';
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

export const useCloudStore = create<CloudState>((set, get) => ({
  available: isFirebaseConfigured(),
  ready: false,
  user: null,
  busy: false,
  lastCloudBackupAt: null,
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
      unsub = await subscribeAuth((user) => set({ user }));
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
      if (!unsub) unsub = await subscribeAuth((u) => set({ user: u }));
      set({ user });
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
