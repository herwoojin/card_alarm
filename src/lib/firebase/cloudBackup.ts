import { getFirebaseStorage } from './client';

/** 사용자 UID별 백업 파일 경로. 보안 규칙(storage.rules)이 본인만 접근하도록 강제한다. */
function backupPath(uid: string): string {
  return `users/${uid}/siljeokon-backup.json`;
}

export interface CloudMeta {
  exists: boolean;
  updatedAt: string | null;
  encrypted: boolean;
}

function isNotFound(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: string }).code === 'storage/object-not-found';
}

/** 백업 문자열(평문 JSON 또는 "enc:..." 암호문)을 클라우드에 업로드. */
export async function uploadBackup(uid: string, content: string): Promise<void> {
  const storage = await getFirebaseStorage();
  const { ref, uploadString } = await import('firebase/storage');
  const r = ref(storage, backupPath(uid));
  await uploadString(r, content, 'raw', {
    contentType: 'application/json',
    customMetadata: { app: 'siljeokon', encrypted: content.startsWith('enc:') ? '1' : '0' },
  });
}

/** 클라우드 백업 문자열을 내려받는다. 없으면 null. */
export async function downloadBackup(uid: string): Promise<string | null> {
  const storage = await getFirebaseStorage();
  const { ref, getBytes } = await import('firebase/storage');
  const r = ref(storage, backupPath(uid));
  try {
    const bytes = await getBytes(r);
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** 클라우드 백업 존재 여부·수정 시각·암호화 여부. */
export async function cloudMeta(uid: string): Promise<CloudMeta> {
  const storage = await getFirebaseStorage();
  const { ref, getMetadata } = await import('firebase/storage');
  const r = ref(storage, backupPath(uid));
  try {
    const m = await getMetadata(r);
    return { exists: true, updatedAt: m.updated ?? null, encrypted: m.customMetadata?.encrypted === '1' };
  } catch (e) {
    if (isNotFound(e)) return { exists: false, updatedAt: null, encrypted: false };
    throw e;
  }
}
