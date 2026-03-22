import { describe, it, expect } from 'vitest'
import type {
  Obligation, SeverityTier, TimePressure, ActionType,
  CashJobs, RevenueEntry, ConfidenceLevel,
  Recommendation, CognitiveState, RecoveryStage,
  Transaction, PoolAssignment, ReviewStatus,
  EngineState, BridgeNode
} from '../types'

describe('Engine Types', () => {
  it('creates a valid Obligation', () => {
    const obligation: Obligation = {
      id: '1',
      name: 'Progressive Auto Insurance',
      amount: 397.55,
      dueDate: new Date('2026-03-28'),
      severityTier: 'insurance_lapse',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.9,
      negotiability: 0.2,
      bestAction: 'pay',
      consequenceIfIgnored: 'insurance lapse — coverage gap',
      cashReserved: 397.55,
      isPastDue: false,
      daysUntilDue: 7,
    }
    expect(obligation.severityTier).toBe('insurance_lapse')
  })

  it('creates valid CashJobs', () => {
    const jobs: CashJobs = {
      survival: 2100,
      operating: 680,
      catchUp: 253,
      untouchable: 450,
      trulyFree: 148,
      total: 3631,
      permissionNumber: 828,
    }
    expect(jobs.permissionNumber).toBe(jobs.operating + jobs.trulyFree)
  })

  it('creates a valid Recommendation', () => {
    const rec: Recommendation = {
      id: '1',
      actionVerb: 'pay',
      target: 'Progressive Auto Insurance',
      amount: 397.55,
      protects: 'auto insurance coverage',
      exposesAfter: 'flex pool drops to $83',
      score: 0.92,
      confidence: 'high',
      rank: 1,
    }
    expect(rec.actionVerb).toBe('pay')
  })

  it('creates a valid EngineState', () => {
    const state: EngineState = {
      permissionNumber: 428,
      cashJobs: {
        survival: 2100, operating: 380, catchUp: 0,
        untouchable: 450, trulyFree: 48, total: 2978,
        permissionNumber: 428,
      },
      cognitiveState: 'calm',
      recoveryStage: 'stable',
      obligations: [],
      recommendations: [],
      bridgeNodes: [],
      revenue: [],
      reviewQueue: [],
    }
    expect(state.cognitiveState).toBe('calm')
  })
})
