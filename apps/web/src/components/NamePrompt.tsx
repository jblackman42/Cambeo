'use client';

import { Modal } from '@/components/Modal';
import { useState } from 'react';

/**
 * Serves both flows: a join link that landed with no name saved on this device,
 * and a player editing the name they already have.
 */
export function NamePrompt({
  initialName = '',
  submitLabel = 'Join room',
  onSubmit,
  onDismiss,
}: {
  initialName?: string;
  submitLabel?: string;
  onSubmit: (name: string) => void;
  onDismiss: () => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      title="Your name"
      size="sm"
      placement="center"
      onClose={onDismiss}
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!trimmed}
          onClick={submit}
        >
          {submitLabel}
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
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
    </Modal>
  );
}
