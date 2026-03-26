import { useState, useRef, useEffect } from 'react';
import { OverlaySurface } from '../shared/OverlaySurface';

interface CaptureOverlayProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function CaptureOverlay({ open, onClose, onSubmit }: CaptureOverlayProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setText('');
  }, [open]);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
    onClose();
  }

  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      initialFocusRef={inputRef}
      containerClassName="z-[200] flex items-start justify-center pt-[20vh]"
      panelClassName="w-full max-w-md"
      backdropClassName="bg-black/30 backdrop-blur-sm"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
        }}
        placeholder="Quick capture..."
        className="w-full px-4 py-3 rounded-xl bg-bg-elevated border border-border text-text-primary text-[15px] placeholder:text-text-muted/50 shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-warm/40"
        maxLength={500}
      />
    </OverlaySurface>
  );
}
