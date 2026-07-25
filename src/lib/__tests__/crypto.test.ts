// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { encryptString, decryptString, isEncrypted } from '../crypto';

describe('crypto — AES-GCM 왕복', () => {
  it('암호화 후 같은 비밀번호로 복호화하면 원문이 나온다', async () => {
    const plain = JSON.stringify({ app: 'siljeokon', cards: [{ id: 'c1', name: '신한' }] });
    const enc = await encryptString(plain, 'my-pass-1234');
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain('신한'); // 평문이 노출되지 않는다
    const dec = await decryptString(enc, 'my-pass-1234');
    expect(dec).toBe(plain);
  });

  it('비밀번호가 틀리면 복호화가 실패한다', async () => {
    const enc = await encryptString('secret', 'right-pass');
    await expect(decryptString(enc, 'wrong-pass')).rejects.toThrow();
  });

  it('매번 다른 salt/iv로 다른 암호문이 나온다', async () => {
    const a = await encryptString('same', 'pass');
    const b = await encryptString('same', 'pass');
    expect(a).not.toBe(b);
    expect(await decryptString(a, 'pass')).toBe('same');
    expect(await decryptString(b, 'pass')).toBe('same');
  });

  it('암호화되지 않은 문자열은 isEncrypted=false', () => {
    expect(isEncrypted('{"app":"siljeokon"}')).toBe(false);
  });
});
