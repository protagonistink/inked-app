import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '@/context/AppContext';
import type { MonthlyPlan } from '@/types';

const TOTAL_STEPS = 3;
const STEP_LABELS = ['Reflect', 'Set Intent', 'Lock It In'];

export function MonthlyPlanningWizard() {
  const {
    monthlyPlan,
    isMonthlyPlanningOpen,
    setMonthlyPlan,
    closeMonthlyPlanning,
    monthlyPlanPrompt,
    openMonthlyPlanning,
    dismissMonthlyPlanPrompt,
  } = useApp();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [reflection, setReflection] = useState(monthlyPlan?.reflection ?? '');
  const [oneThing, setOneThing] = useState(monthlyPlan?.oneThing ?? '');
  const [why, setWhy] = useState(monthlyPlan?.why ?? '');

  useEffect(() => {
    if (!isMonthlyPlanningOpen) return;
    setStep(1);
    setReflection(monthlyPlan?.reflection ?? '');
    setOneThing(monthlyPlan?.oneThing ?? '');
    setWhy(monthlyPlan?.why ?? '');
  }, [isMonthlyPlanningOpen, monthlyPlan]);

  const monthLabel = new Date()
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
  const monthShort = new Date().toLocaleDateString('en-US', { month: 'long' });
  const monthKey = new Date().toISOString().slice(0, 7);

  function handleSave() {
    const plan: MonthlyPlan = { month: monthKey, reflection, oneThing, why };
    setMonthlyPlan(plan);
    setStep(1);
  }

  return (
    <>
      {/* Monthly plan prompt */}
      {monthlyPlanPrompt && !isMonthlyPlanningOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 max-w-sm mx-6 bg-bg-elevated border border-border rounded-xl p-8 text-center">
            <div className="font-display italic text-[20px] font-light text-text-primary mb-2">
              {monthShort} hasn't been planned yet.
            </div>
            <div className="text-[13px] text-text-muted leading-relaxed mb-6">
              Take 3 minutes to set your intention for the month.
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={openMonthlyPlanning}
                className="bg-accent-warm text-bg px-5 py-2 rounded-md text-[13px] font-medium hover:bg-accent-warm/90 transition-colors"
              >
                Plan {monthShort} now
              </button>
              <button
                onClick={dismissMonthlyPlanPrompt}
                className="text-[13px] text-text-muted hover:text-text-primary transition-colors px-4 py-2"
              >
                Skip today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly planning wizard */}
      {isMonthlyPlanningOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-xl mx-6 bg-bg-elevated border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-7 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i < step ? 'bg-text-primary' : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
                  {STEP_LABELS[step - 1]}
                </span>
              </div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
                {monthLabel}
              </span>
              <button
                onClick={closeMonthlyPlanning}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-8 py-7 hide-scrollbar">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={{
                    initial: (d: number) => ({ x: d * 16, opacity: 0 }),
                    animate: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: d * -16, opacity: 0 }),
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {step === 1 && (
                    <>
                      <div className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
                        Where are you now?
                      </div>
                      <div className="text-[13px] text-text-muted mt-2 leading-relaxed">
                        What's working? What's been heavy? How's the shape of things?
                      </div>
                      <textarea
                        rows={6}
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                        placeholder="Write freely…"
                        className="mt-6 w-full bg-transparent border-b border-border-subtle outline-none resize-none text-[14px] text-text-primary placeholder:text-text-muted py-3 leading-relaxed"
                      />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
                        The one thing.
                      </div>
                      <div className="text-[13px] text-text-muted mt-2 leading-relaxed">
                        What most needs to move this month? One sentence.
                      </div>
                      <input
                        type="text"
                        value={oneThing}
                        onChange={(e) => setOneThing(e.target.value)}
                        placeholder="Name the one thing…"
                        className="mt-6 font-display italic text-[22px] font-light text-text-primary bg-transparent border-b border-border-subtle focus:border-accent-warm/40 outline-none w-full py-3 transition-colors"
                      />
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
                        Why does it matter?
                      </div>
                      <div className="text-[13px] text-text-muted mt-2 leading-relaxed">
                        Why this? Why now?
                      </div>
                      <textarea
                        rows={4}
                        value={why}
                        onChange={(e) => setWhy(e.target.value)}
                        placeholder="Write freely…"
                        className="mt-6 w-full bg-transparent border-b border-border-subtle outline-none resize-none text-[14px] text-text-primary placeholder:text-text-muted py-3 leading-relaxed"
                      />
                      {oneThing.trim().length > 0 && why.trim().length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="mt-8 flex flex-col items-center gap-3"
                        >
                          <div className="w-full border-t border-border-subtle" />
                          <div className="py-4 flex flex-col items-center gap-2 text-center">
                            <div className="font-display italic text-[22px] font-light text-text-primary leading-snug max-w-sm">
                              {oneThing}
                            </div>
                            <div className="text-[13px] text-text-muted italic max-w-xs leading-relaxed">
                              {why}
                            </div>
                          </div>
                          <div className="w-full border-b border-border-subtle" />
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-8 pb-7 pt-4 border-t border-border-subtle shrink-0">
              {step > 1 ? (
                <button
                  onClick={() => { setDirection(-1); setStep((s) => s - 1); }}
                  className="text-[13px] text-text-muted hover:text-text-primary transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}

              {step < TOTAL_STEPS ? (
                <button
                  onClick={() => { setDirection(1); setStep((s) => s + 1); }}
                  className="px-5 py-2 rounded-md bg-bg-card border border-border text-[13px] font-medium text-text-primary hover:bg-bg hover:border-text-muted/20 transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={oneThing.trim().length === 0}
                  className="px-5 py-2 rounded-md bg-accent-warm text-bg text-[13px] font-medium hover:bg-accent-warm/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lock in {monthShort}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
