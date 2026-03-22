import type { RevenueEntry, ConfidenceLevel } from './types'

const ALLOCATABLE_LEVELS: ConfidenceLevel[] = ['confirmed', 'invoiced']

export function filterAllocatableRevenue(revenue: RevenueEntry[]): RevenueEntry[] {
  return revenue.filter(r => ALLOCATABLE_LEVELS.includes(r.confidence))
}

export function getRevenueUnlocks(revenue: RevenueEntry[]): Record<string, string[]> {
  const unlocks: Record<string, string[]> = {}
  for (const r of revenue) {
    if (r.unlocks.length > 0) unlocks[r.id] = r.unlocks
  }
  return unlocks
}

export function sumAllocatableRevenue(revenue: RevenueEntry[]): number {
  return filterAllocatableRevenue(revenue).reduce((sum, r) => sum + r.amount, 0)
}
