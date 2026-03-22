import { describe, it, expect } from 'vitest'
import { inferCognitiveState } from '../cognitiveStateInferrer'

describe('inferCognitiveState', () => {
  it('returns calm when stable with healthy buffer', () => {
    const state = inferCognitiveState({
      recoveryStage: 'stable', pastDueCount: 0,
      bufferToObligationRatio: 2.5, actLevelItemCount: 0,
      daysUntilCashNegative: 30, reviewQueueDepth: 2,
    })
    expect(state).toBe('calm')
  })

  it('returns compressed when in triage', () => {
    const state = inferCognitiveState({
      recoveryStage: 'triage', pastDueCount: 4,
      bufferToObligationRatio: 0.3, actLevelItemCount: 3,
      daysUntilCashNegative: 3, reviewQueueDepth: 10,
    })
    expect(state).toBe('compressed')
  })

  it('returns alert when buffer is thin but manageable', () => {
    const state = inferCognitiveState({
      recoveryStage: 'tight', pastDueCount: 0,
      bufferToObligationRatio: 1.2, actLevelItemCount: 1,
      daysUntilCashNegative: 10, reviewQueueDepth: 3,
    })
    expect(state).toBe('alert')
  })

  it('returns compressed when 3+ past-due regardless of stage', () => {
    const state = inferCognitiveState({
      recoveryStage: 'stable', pastDueCount: 3,
      bufferToObligationRatio: 2.0, actLevelItemCount: 0,
      daysUntilCashNegative: 20, reviewQueueDepth: 0,
    })
    expect(state).toBe('compressed')
  })
})
