import { describe, it, expect } from 'vitest'
import { buildBridge } from '../timePressureMapper'
import type { Obligation, RevenueEntry } from '../types'

describe('buildBridge', () => {
  it('returns nodes sorted by date', () => {
    const today = new Date('2026-03-21')
    const obligations: Obligation[] = [{
      id: '1', name: 'Insurance', amount: 397.55,
      dueDate: new Date('2026-03-28'), severityTier: 'insurance_lapse',
      timePressure: 'due_this_week', reliefPerDollar: 0.9,
      negotiability: 0.2, bestAction: 'pay',
      consequenceIfIgnored: 'coverage gap', cashReserved: 0,
      isPastDue: false, daysUntilDue: 7,
    }]
    const revenue: RevenueEntry[] = [{
      id: 'r1', amount: 2000, expectedDate: new Date('2026-03-25'),
      confidence: 'confirmed', sourceType: 'salary',
      unlocks: ['1'], description: 'Paycheck',
    }]
    const nodes = buildBridge(obligations, revenue, today, 14)
    expect(nodes.length).toBe(2)
    expect(nodes[0].date <= nodes[1].date).toBe(true)
    expect(nodes[0].name).toBe('Paycheck')
    expect(nodes[1].name).toBe('Insurance')
  })

  it('excludes events beyond the window', () => {
    const today = new Date('2026-03-21')
    const obligations: Obligation[] = [{
      id: '1', name: 'Far Bill', amount: 100,
      dueDate: new Date('2026-04-15'), severityTier: 'annoyance_reputational',
      timePressure: 'due_this_week', reliefPerDollar: 0.5,
      negotiability: 0.3, bestAction: 'pay',
      consequenceIfIgnored: 'late fee', cashReserved: 0,
      isPastDue: false, daysUntilDue: 25,
    }]
    expect(buildBridge(obligations, [], today, 14)).toHaveLength(0)
  })
})
