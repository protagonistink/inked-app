interface BalanceAwarenessProps {
  message: string | null;
}

export function BalanceAwareness({ message }: BalanceAwarenessProps) {
  if (!message) return null;

  return (
    <div className="select-none border-l-2 border-text-muted/20 pl-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-whisper mb-2 block">
        BALANCE
      </span>
      <p className="text-[12px] italic text-text-muted/75 leading-snug">
        {message}
      </p>
    </div>
  );
}
