import { describe, it, expect } from 'vitest'
import { detectRecoveryStage } from '../recoveryStageDetector'

describe('detectRecoveryStage', () => {
  it('returns stable when buffer is healthy and no past-due', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 0, bufferAmount: 3000, monthlyObligations: 2000,
      hasRecentIncomeInterruption: false, debtToIncomeRatio: 0.2,
    })
    expect(stage).toBe('stable')
  })

  it('returns triage when multiple past-due and thin buffer', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 4, bufferAmount: 200, monthlyObligations: 2000,
      hasRecentIncomeInterruption: false, debtToIncomeRatio: 0.6,
    })
    expect(stage).toBe('triage')
  })

  it('returns income_interruption when flagged', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 0, bufferAmount: 500, monthlyObligations: 2000,
      hasRecentIncomeInterruption: true, debtToIncomeRatio: 0.3,
    })
    expect(stage).toBe('income_interruption')
  })

  it('returns tight when buffer is thin but no past-due', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 0, bufferAmount: 300, monthlyObligations: 2000,
      hasRecentIncomeInterruption: false, debtToIncomeRatio: 0.4,
    })
    expect(stage).toBe('tight')
  })

  it('does NOT return arrears_recovery when past-due exists but buffer is healthy', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 1, bufferAmount: 5000, monthlyObligations: 2000,
      hasRecentIncomeInterruption: false, debtToIncomeRatio: 0.3,
    })
    expect(stage).not.toBe('arrears_recovery')
  })

  it('returns arrears_recovery when past-due AND thin buffer', () => {
    const stage = detectRecoveryStage({
      pastDueCount: 2, bufferAmount: 400, monthlyObligations: 2000,
      hasRecentIncomeInterruption: false, debtToIncomeRatio: 0.4,
    })
    expect(stage).toBe('arrears_recovery')
  })
})
