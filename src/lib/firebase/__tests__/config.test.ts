import { describe, it, expect } from 'vitest';
import { readFirebaseConfig, isFirebaseConfigured } from '../config';

describe('firebase config', () => {
  it('기본값이 있어 설정됨으로 인식된다', () => {
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('필수 필드를 반환한다', () => {
    const cfg = readFirebaseConfig();
    expect(cfg).not.toBeNull();
    expect(cfg?.projectId).toBe('card-alarm-service');
    expect(cfg?.storageBucket).toContain('card-alarm-service');
    expect(cfg?.authDomain).toContain('card-alarm-service');
  });
});
