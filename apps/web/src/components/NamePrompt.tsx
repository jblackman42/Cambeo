'use client';

import { Modal } from '@/components/Modal';
import { useState } from 'react';

/** Shown when a join link lands someone in a room with no name saved on this device. */
export function NamePrompt({
  onSubmit,
  onDismiss,
}: {
  onSubmit: (name: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      title="Your name"
      size="sm"
      onClose={() => (trimmed ? onSubmit(trimmed) : onDismiss())}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!trimmed}
          onClick={submit}
        >
          Join room
        </button>
      }
    >
      <input
        className="text-input"
        value={name}
        autoFocus
        maxLength={20}
        aria-label="Your name"
        placeholder="Alex"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
    </Modal>
  );
}
