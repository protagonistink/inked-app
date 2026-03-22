import { describe, it, expect } from 'vitest'
import { generateRecommendations } from '../recommendationEngine'
import type { ScoredObligation } from '../consequenceScorer'

const makeScoredObl = (overrides: Partial<ScoredObligation>): ScoredObligation => ({
  id: '1', name: 'Test', amount: 100, dueDate: new Date(),
  severityTier: 'annoyance_reputational', timePressure: 'due_this_week',
  reliefPerDollar: 0.5, negotiability: 0.3, bestAction: 'pay',
  consequenceIfIgnored: 'late fee', cashReserved: 0,
  isPastDue: false, daysUntilDue: 7, compositeScore: 0.5,
  ...overrides,
})

describe('generateRecommendations', () => {
  it('returns max 3 recommendations', () => {
    const obligations = Array.from({ length: 5 }, (_, i) =>
      makeScoredObl({ id: String(i), name: `Bill ${i}` })
    )
    const recs = generateRecommendations(obligations, 1000)
    expect(recs.length).toBeLessThanOrEqual(3)
  })

  it('recommends call when negotiability is high', () => {
    const obligations = [
      makeScoredObl({ id: '1', name: 'Old Debt', negotiability: 0.9, bestAction: 'call' }),
    ]
    const recs = generateRecommendations(obligations, 1000)
    expect(recs[0].actionVerb).toBe('call')
  })

  it('sets low confidence when data is stale', () => {
    const obligations = [makeScoredObl({ id: '1' })]
    const recs = generateRecommendations(obligations, 1000, { dataFreshnessHours: 48 })
    expect(recs[0].confidence).toBe('low')
  })

  it('includes protects and exposesAfter on each recommendation', () => {
    const obligations = [makeScoredObl({})]
    const recs = generateRecommendations(obligations, 1000)
    expect(recs[0]).toHaveProperty('protects')
    expect(recs[0]).toHaveProperty('exposesAfter')
  })
})
