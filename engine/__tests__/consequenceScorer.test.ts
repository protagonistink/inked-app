import { describe, it, expect } from 'vitest'
import { scoreObligations } from '../consequenceScorer'
import type { Obligation } from '../types'

const makeObligation = (overrides: Partial<Obligation>): Obligation => ({
  id: '1',
  name: 'Test Bill',
  amount: 100,
  dueDate: new Date('2026-03-28'),
  severityTier: 'annoyance_reputational',
  timePressure: 'due_this_week',
  reliefPerDollar: 0.5,
  negotiability: 0.3,
  bestAction: 'pay',
  consequenceIfIgnored: 'late fee',
  cashReserved: 0,
  isPastDue: false,
  daysUntilDue: 7,
  ...overrides,
})

describe('scoreObligations', () => {
  it('ranks housing loss above annoyance', () => {
    const obligations = [
      makeObligation({ id: '1', name: 'Old Credit Card', severityTier: 'annoyance_reputational' }),
      makeObligation({ id: '2', name: 'Rent', severityTier: 'housing_loss' }),
    ]
    const ranked = scoreObligations(obligations)
    expect(ranked[0].name).toBe('Rent')
  })

  it('ranks due_today above due_this_week at same severity', () => {
    const obligations = [
      makeObligation({ id: '1', name: 'Bill A', timePressure: 'due_this_week' }),
      makeObligation({ id: '2', name: 'Bill B', timePressure: 'due_today' }),
    ]
    const ranked = scoreObligations(obligations)
    expect(ranked[0].name).toBe('Bill B')
  })

  it('ranks high relief-per-dollar above low at same severity and timing', () => {
    const obligations = [
      makeObligation({ id: '1', name: 'Big Debt', reliefPerDollar: 0.2, amount: 2000 }),
      makeObligation({ id: '2', name: 'Small Bill', reliefPerDollar: 0.9, amount: 50 }),
    ]
    const ranked = scoreObligations(obligations)
    expect(ranked[0].name).toBe('Small Bill')
  })

  it('returns composite score on each obligation', () => {
    const obligations = [makeObligation({})]
    const ranked = scoreObligations(obligations)
    expect(ranked[0]).toHaveProperty('compositeScore')
    expect(typeof ranked[0].compositeScore).toBe('number')
    expect(ranked[0].compositeScore).toBeGreaterThan(0)
  })
})
