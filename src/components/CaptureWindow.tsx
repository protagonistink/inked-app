import { useState, useEffect, useRef } from 'react';

export function CaptureWindow() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleFocus = () => inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void window.api.window.hideCapture();
      }
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSubmit = async () => {
    if (!value.trim()) {
      void window.api.window.hideCapture();
      return;
    }
    await window.api.capture.save(value.trim());
    setSaved(true);
    setValue('');
    setTimeout(() => {
      void window.api.window.hideCapture();
      setSaved(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent p-3">
      <div className="w-full bg-[#141414] border border-white/10 rounded-[14px] px-4 flex items-center gap-3 shadow-2xl overflow-hidden">
        {/* Ink dot indicator */}
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200"
          style={{ background: saved ? '#4CAF50' : 'rgba(190,90,55,0.8)' }}
        />
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture a thought..."
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none font-sans text-[15px] leading-relaxed py-[18px]"
          style={{
            color: 'rgba(225,215,200,0.9)',
            caretColor: 'rgba(190,90,55,0.9)',
          }}
        />
        <div className="text-[10px] tracking-[0.12em] uppercase flex-shrink-0" style={{ color: 'rgba(160,150,130,0.35)' }}>
          {saved ? 'Saved' : 'Enter \u21B5'}
        </div>
      </div>
    </div>
  );
}
