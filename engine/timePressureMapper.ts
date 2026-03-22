import type { Obligation, RevenueEntry, BridgeNode } from './types'

export function buildBridge(
  obligations: Obligation[],
  revenue: RevenueEntry[],
  today: Date,
  windowDays: number = 14
): BridgeNode[] {
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + windowDays)

  const nodes: BridgeNode[] = []

  for (const obl of obligations) {
    if (obl.dueDate >= today && obl.dueDate <= windowEnd) {
      nodes.push({
        date: obl.dueDate, eventType: 'bill', name: obl.name,
        amount: obl.amount, netEffect: -obl.amount,
        consequenceTier: obl.severityTier,
      })
    }
  }

  for (const rev of revenue) {
    if (rev.expectedDate >= today && rev.expectedDate <= windowEnd) {
      nodes.push({
        date: rev.expectedDate, eventType: 'income', name: rev.description,
        amount: rev.amount, netEffect: rev.amount, consequenceTier: null,
      })
    }
  }

  return nodes.sort((a, b) => a.date.getTime() - b.date.getTime())
}
