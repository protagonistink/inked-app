import { useState, useEffect, useRef } from 'react';

export function QuickCaptureNote() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Change 2: system color-scheme detection
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const bgGradient = isDark
    ? 'linear-gradient(160deg, #BAE6FD 0%, #93C5FD 100%)'
    : 'linear-gradient(160deg, #FDE68A 0%, #F9CF58 100%)';

  useEffect(() => {
    // Focus when the Electron window gains focus (fires on every show)
    const onWindowFocus = () => textareaRef.current?.focus();
    window.addEventListener('focus', onWindowFocus);
    // Also focus immediately in case the window is already visible at mount
    textareaRef.current?.focus();
    return () => window.removeEventListener('focus', onWindowFocus);
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
      style={{
        background: bgGradient,
        color: '#000000',
        fontFamily: 'Optima, Candara, sans-serif',
        position: 'relative',
        boxShadow: '0 4px 16px rgba(0,0,0,0.20), 5px 5px 0 rgba(0,0,0,0.06)',
      }}
    >
      {/* Drag handle */}
      <div
        className="h-8 flex items-center px-3 shrink-0 cursor-default"
        style={{
          WebkitAppRegion: 'drag',
          borderBottom: `1px solid ${isDark ? 'rgba(30,64,175,0.15)' : 'rgba(120,53,15,0.12)'}`,
        } as React.CSSProperties}
      >
        <div className="flex gap-1.5 opacity-30">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: isDark ? '#1e40af' : '#78350f' }} />
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
          color: '#000000',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      />

      {/* Footer */}
      <div
        className="flex justify-between items-center px-4 pb-3 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span style={{ fontSize: 11, opacity: 0.45, color: '#000000' }}>↵ save · esc dismiss</span>
        {text.length > 0 && (
          <span style={{ fontSize: 11, opacity: 0.45, color: '#000000' }}>{text.length}/500</span>
        )}
      </div>

      {/* Corner shadow — soft radial darkening to suggest curl */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 72,
          height: 72,
          background: 'radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.16) 0%, transparent 68%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
