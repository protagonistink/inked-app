interface EndOfDayNudgeProps {
  visible: boolean;
  onClick: () => void;
}

export function EndOfDayNudge({ visible, onClick }: EndOfDayNudgeProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left font-display font-medium text-[11px] text-text-secondary/60 hover:text-text-secondary/85 transition-colors duration-150 leading-snug border-l-2 border-accent-warm/30 pl-3"
    >
      Close the day
    </button>
  );
}
