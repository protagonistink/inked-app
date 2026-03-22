import type { RecoveryStage } from './types'

export interface RecoveryStageInputs {
  pastDueCount: number
  bufferAmount: number
  monthlyObligations: number
  hasRecentIncomeInterruption: boolean
  debtToIncomeRatio: number
}

export function detectRecoveryStage(inputs: RecoveryStageInputs): RecoveryStage {
  if (inputs.hasRecentIncomeInterruption) return 'income_interruption'

  const bufferRatio = inputs.bufferAmount / Math.max(inputs.monthlyObligations, 1)

  if (inputs.pastDueCount >= 3 && bufferRatio < 0.5) return 'triage'
  if (inputs.pastDueCount >= 1 && bufferRatio < 0.5) return 'arrears_recovery'

  if (bufferRatio < 0.3) return 'tight'
  if (inputs.debtToIncomeRatio > 0.5 && bufferRatio < 1.0) return 'tight'

  if (inputs.debtToIncomeRatio <= 0.2 && bufferRatio >= 1.5) return 'stable'

  return 'rebuild'
}
