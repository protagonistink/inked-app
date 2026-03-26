import { useState, useEffect, useRef } from 'react';

export function QuickCaptureNote() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit() {
    const trimmed = text.trim();
    if (trimmed) {
      void window.api.capture.add(trimmed);
    }
    setText('');
    void window.api.capture.hideCaptureWindow();
  }

  function dismiss() {
    setText('');
    void window.api.capture.hideCaptureWindow();
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#FDE68A', color: '#451a03' }}
    >
      {/* Drag handle */}
      <div
        className="h-8 flex items-center px-3 shrink-0 cursor-default"
        style={{
          WebkitAppRegion: 'drag',
          borderBottom: '1px solid rgba(120,53,15,0.12)',
        } as React.CSSProperties}
      >
        <div className="flex gap-1.5 opacity-30">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: '#78350f' }} />
          ))}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
        }}
        placeholder="Capture a thought..."
        className="flex-1 resize-none px-4 pt-3 pb-1 text-[15px] leading-relaxed focus:outline-none"
        style={{
          background: 'transparent',
          color: '#451a03',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      />

      {/* Footer */}
      <div
        className="flex justify-between items-center px-4 pb-3 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span style={{ fontSize: 11, opacity: 0.45, color: '#451a03' }}>↵ save · esc dismiss</span>
        {text.length > 0 && (
          <span style={{ fontSize: 11, opacity: 0.45, color: '#451a03' }}>{text.length}/500</span>
        )}
      </div>
    </div>
  );
}
