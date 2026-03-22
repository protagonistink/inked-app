import { describe, it, expect } from 'vitest'
import { filterAllocatableRevenue, getRevenueUnlocks } from '../revenueTracker'
import type { RevenueEntry } from '../types'

const makeRevenue = (overrides: Partial<RevenueEntry>): RevenueEntry => ({
  id: '1', amount: 2000, expectedDate: new Date('2026-04-01'),
  confidence: 'confirmed', sourceType: 'salary', unlocks: [],
  description: 'Monthly salary', ...overrides,
})

describe('filterAllocatableRevenue', () => {
  it('includes confirmed and invoiced revenue', () => {
    const revenue = [
      makeRevenue({ id: '1', confidence: 'confirmed' }),
      makeRevenue({ id: '2', confidence: 'invoiced' }),
    ]
    expect(filterAllocatableRevenue(revenue)).toHaveLength(2)
  })

  it('excludes speculative revenue', () => {
    expect(filterAllocatableRevenue([makeRevenue({ confidence: 'speculative' })])).toHaveLength(0)
  })

  it('excludes verbal revenue', () => {
    expect(filterAllocatableRevenue([makeRevenue({ confidence: 'verbal' })])).toHaveLength(0)
  })
})

describe('getRevenueUnlocks', () => {
  it('maps revenue to obligation IDs it unlocks', () => {
    const revenue = [
      makeRevenue({ id: 'rev1', unlocks: ['obl1', 'obl2'] }),
      makeRevenue({ id: 'rev2', unlocks: ['obl3'] }),
    ]
    const unlocks = getRevenueUnlocks(revenue)
    expect(unlocks).toEqual({ rev1: ['obl1', 'obl2'], rev2: ['obl3'] })
  })
})
