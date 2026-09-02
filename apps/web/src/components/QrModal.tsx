'use client';

import { Modal } from '@/components/Modal';
import { QRCodeSVG } from 'qrcode.react';

export function QrModal({
  url,
  roomCode,
  onClose,
}: {
  url: string;
  roomCode: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Scan to join" onClose={onClose} size="sm">
      <div className="qr-wrap">
        <QRCodeSVG value={url} size={248} level="M" marginSize={2} bgColor="#ffffff" fgColor="#09090b" />
      </div>
      <p className="qr-code-caption tabular">{roomCode}</p>
    </Modal>
  );
}
