import type { CognitiveState, RecoveryStage } from './types'

export interface CognitiveStateInputs {
  recoveryStage: RecoveryStage
  pastDueCount: number
  bufferToObligationRatio: number
  actLevelItemCount: number
  daysUntilCashNegative: number
  reviewQueueDepth: number
}

const COMPRESSED_STAGES: RecoveryStage[] = ['triage', 'arrears_recovery', 'income_interruption']

export function inferCognitiveState(inputs: CognitiveStateInputs): CognitiveState {
  if (COMPRESSED_STAGES.includes(inputs.recoveryStage)) return 'compressed'
  if (inputs.pastDueCount >= 3) return 'compressed'
  if (inputs.bufferToObligationRatio < 0.5) return 'compressed'
  if (inputs.actLevelItemCount >= 2) return 'compressed'

  if (inputs.recoveryStage === 'tight') return 'alert'
  if (inputs.bufferToObligationRatio < 1.5) return 'alert'
  if (inputs.actLevelItemCount === 1) return 'alert'
  if (inputs.daysUntilCashNegative < 7) return 'alert'

  return 'calm'
}
