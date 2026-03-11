type IconProps = {
  className?: string;
};

export function AppMark({ className }: IconProps) {
  return (
    <img
      src="/icon.png"
      alt="TimeFocus"
      className={className}
    />
  );
}

export function AsanaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="7" cy="17" r="4" fill="#F06A6A" />
      <circle cx="17" cy="17" r="4" fill="#FCB86D" />
      <circle cx="12" cy="8" r="4" fill="#8F6BFF" />
    </svg>
  );
}

export function GmailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 7.5 12 14l9-6.5" stroke="#EA4335" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18V8.7L12 14l7-5.3V18" stroke="#34A853" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 18V7l3.8 2.8V18" stroke="#4285F4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 18V7l-3.8 2.8V18" stroke="#FBBC05" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GCalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" fill="#4285F4" />
      <path d="M8 3.5V7M16 3.5V7" stroke="#4285F4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 9h16" stroke="#DCE8FF" strokeWidth="1.6" />
      <path d="M12.2 11.7v3.2h2.9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="4.2" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}
