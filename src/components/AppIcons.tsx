type IconProps = {
  className?: string;
};

export function AppMark({ className }: IconProps) {
  return (
    <img
      src="/icon.png"
      alt="Threadline"
      className={className}
    />
  );
}

export function AppWordmark({ className }: IconProps) {
  return (
    <img
      src="/threadline_wordmark.png"
      alt="Threadline"
      className={className}
    />
  );
}

export function AsanaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="7" cy="17" r="4" fill="currentColor" />
      <circle cx="17" cy="17" r="4" fill="currentColor" />
      <circle cx="12" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

export function GmailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 7.5 12 14l9-6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18V8.7L12 14l7-5.3V18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 18V7l3.8 2.8V18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 18V7l-3.8 2.8V18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GCalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" fill="currentColor" fillOpacity="0.3" />
      <path d="M8 3.5V7M16 3.5V7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5" />
      <path d="M12.2 11.7v3.2h2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="4.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
