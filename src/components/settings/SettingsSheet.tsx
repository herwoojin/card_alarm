'use client';

import { useRef, useState } from 'react';
import { exportAll, readBackupFile } from '@/lib/db/backup';
import { useAppStore } from '@/store/useAppStore';
import { useUI } from '@/components/ui/ui-context';
import { CloudSection } from './CloudSection';

export function SettingsSheet() {
  const importBackup = useAppStore((s) => s.importBackup);
  const wipe = useAppStore((s) => s.wipe);
  const ui = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown | null>(null);

  const onExport = async () => {
    const ok = window.confirm(
      '이 파일에는 카드 뒷자리와 결제 내역이 그대로 들어갑니다. 안전한 곳에 보관하세요. 계속할까요?',
    );
    if (!ok) return;
    await exportAll();
    ui.toast('백업 파일을 내려받았습니다');
  };

  const onPickFile = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      setPending(parsed);
    } catch {
      ui.toast('백업 파일을 읽지 못했습니다');
    }
  };

  const doImport = async (mode: 'merge' | 'overwrite') => {
    if (pending == null) return;
    try {
      const r = await importBackup(pending, mode);
      setPending(null);
      ui.toast(`가져왔습니다 · 카드 ${r.cards}장 · 거래 ${r.transactions}건${r.skippedDuplicates ? ` · 중복 ${r.skippedDuplicates}건 건너뜀` : ''}`);
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : '가져오기에 실패했습니다');
    }
  };

  const onWipe = async () => {
    if (!window.confirm('모든 카드와 결제 내역을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) return;
    if (!window.confirm('정말 삭제할까요? 백업 파일이 없으면 복구할 방법이 없습니다.')) return;
    await wipe();
    ui.closeSheet();
    ui.toast('전체 데이터를 삭제했습니다');
  };

  return (
    <>
      <h3>설정 · 백업</h3>
      <p className="sh-sub">기본은 이 기기에만 저장됩니다. 클라우드 백업은 선택입니다.</p>

      <a className="btn ghost" href="/guide" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 4 }}>
        📖 아주 쉽게 보는 사용법
      </a>

      <CloudSection />

      <div className="sec">기기 백업 (파일)</div>
      <button className="btn" onClick={onExport}>백업 내보내기 (JSON)</button>
      <div className="btnrow">
        <button className="btn ghost" onClick={onPickFile}>백업 가져오기</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />

      {pending != null ? (
        <div className="banner">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>가져오기 방식을 고르세요</div>
          <div className="btnrow" style={{ marginTop: 0 }}>
            <button className="btn sm" onClick={() => doImport('merge')}>병합 (중복 제외)</button>
            <button className="btn ghost sm" onClick={() => doImport('overwrite')}>덮어쓰기</button>
            <button className="btn ghost sm" onClick={() => setPending(null)}>취소</button>
          </div>
        </div>
      ) : null}

      <p className="note">
        백업 파일에는 카드 뒷자리, 가맹점 이름, 결제 금액이 평문으로 들어 있습니다. 아무 데나 올리지 마세요. 한 달에 한 번 정도 받아 두시면 됩니다.
      </p>

      <div className="sec">위험 구역</div>
      <button className="btn warn" onClick={onWipe}>전체 데이터 삭제</button>
      <p className="note">이 기기에 저장된 모든 카드·거래·설정을 지웁니다. 되돌릴 수 없습니다.</p>

      <div className="sec">개인정보</div>
      <p className="note">
        결제 내역과 카드 정보는 이 기기의 브라우저 저장소에만 기록되며 서버로 전송되지 않습니다. 계정·로그인이 없고, 카드번호 전체·CVC·비밀번호는 어떤 형태로도 저장하지 않습니다.
      </p>
    </>
  );
}
