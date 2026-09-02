'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyLinkField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="copy-field">
      <input
        className="copy-field-input"
        readOnly
        value={url}
        aria-label="Invite link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="icon-btn copy-field-btn"
        onClick={() => void copy()}
        aria-label={copied ? 'Link copied' : 'Copy invite link'}
        title={copied ? 'Copied' : 'Copy link'}
        data-copied={copied}
      >
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
      </button>
    </div>
  );
}
