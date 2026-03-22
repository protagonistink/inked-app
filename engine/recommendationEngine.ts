import type { Recommendation } from './types'
import type { ScoredObligation } from './consequenceScorer'

interface RecommendationOptions {
  dataFreshnessHours?: number
}

function getCertainty(freshnessHours: number): number {
  if (freshnessHours <= 1) return 1.0
  if (freshnessHours <= 24) return 0.7
  return 0.5
}

function getConfidenceLabel(certainty: number): 'high' | 'medium' | 'low' {
  if (certainty >= 0.8) return 'high'
  if (certainty >= 0.6) return 'medium'
  return 'low'
}

function getCognitiveEase(obligation: ScoredObligation): number {
  const easeByAction: Record<string, number> = {
    pay: 0.9, defer: 0.8, call: 0.6, ignore: 1.0, split: 0.4, hardship: 0.3,
  }
  return easeByAction[obligation.bestAction] ?? 0.5
}

function getShameReduction(obligation: ScoredObligation): number {
  if (obligation.isPastDue) return 1.0
  if (['housing_loss', 'utility_shutoff', 'insurance_lapse'].includes(obligation.severityTier)) return 0.8
  return 0.5
}

export function generateRecommendations(
  scoredObligations: ScoredObligation[],
  availableCash: number,
  options: RecommendationOptions = {}
): Recommendation[] {
  const freshnessHours = options.dataFreshnessHours ?? 0
  const certainty = getCertainty(freshnessHours)

  const recommendations: Recommendation[] = scoredObligations
    .slice(0, 3)
    .map((obl, index) => {
      const cognitiveEase = getCognitiveEase(obl)
      const shameReduction = getShameReduction(obl)
      const finalScore = obl.compositeScore * cognitiveEase * certainty * shameReduction
      const remainingAfter = availableCash - obl.amount

      return {
        id: obl.id,
        actionVerb: obl.bestAction,
        target: obl.name,
        amount: obl.amount,
        protects: obl.consequenceIfIgnored,
        exposesAfter: remainingAfter > 0
          ? `$${remainingAfter.toFixed(0)} remaining`
          : 'cash fully committed',
        score: finalScore,
        confidence: getConfidenceLabel(certainty),
        rank: index + 1,
      }
    })

  return recommendations.sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}
