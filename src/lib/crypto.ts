/**
 * 클라이언트 측 암호화 (WebCrypto AES-GCM + PBKDF2).
 *
 * 클라우드 백업을 올리기 전에 사용자의 비밀번호로 암호화한다. 서버(Firebase)는 평문을
 * 절대 보지 못한다 — 이것이 이 앱의 "결제 데이터가 기기를 벗어나지 않는다" 원칙을
 * 클라우드에서도 최대한 지키는 방법이다. (비밀번호를 잊으면 복구 불가 — E2E의 대가)
 *
 * 포맷: "enc:" + base64( MAGIC(4) | salt(16) | iv(12) | ciphertext )
 */
const MAGIC = 'SJO1';
const PBKDF2_ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 문자열을 비밀번호로 암호화해 "enc:..." 페이로드를 반환. */
export async function encryptString(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('비밀번호가 필요합니다.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext) as BufferSource),
  );
  const packed = concat(new TextEncoder().encode(MAGIC), salt, iv, ct);
  return 'enc:' + bytesToBase64(packed);
}

/** "enc:..." 페이로드를 비밀번호로 복호화해 원문 반환. 비밀번호가 틀리면 예외. */
export async function decryptString(payload: string, passphrase: string): Promise<string> {
  if (!isEncrypted(payload)) throw new Error('암호화된 데이터가 아닙니다.');
  const packed = base64ToBytes(payload.slice(4));
  const magic = new TextDecoder().decode(packed.subarray(0, 4));
  if (magic !== MAGIC) throw new Error('알 수 없는 암호문 형식입니다.');
  const salt = packed.subarray(4, 20);
  const iv = packed.subarray(20, 32);
  const ct = packed.subarray(32);
  const key = await deriveKey(passphrase, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('비밀번호가 틀렸거나 데이터가 손상되었습니다.');
  }
}

export function isEncrypted(payload: string): boolean {
  return typeof payload === 'string' && payload.startsWith('enc:');
}
