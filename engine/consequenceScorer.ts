import type { Obligation, SeverityTier, TimePressure } from './types'

export type ScoredObligation = Obligation & { compositeScore: number }

const SEVERITY_WEIGHTS: Record<SeverityTier, number> = {
  housing_loss: 1.0,
  utility_shutoff: 0.85,
  insurance_lapse: 0.75,
  transportation: 0.65,
  medical_access: 0.55,
  collections_fee_apr: 0.3,
  annoyance_reputational: 0.1,
}

const TIME_WEIGHTS: Record<TimePressure, number> = {
  due_today: 1.0,
  due_this_week: 0.8,
  past_due_escalating: 0.9,
  past_due_stable: 0.4,
  flexible_if_contacted: 0.3,
  inflexible_if_missed: 0.7,
}

export function scoreObligation(obligation: Obligation): ScoredObligation {
  const severity = SEVERITY_WEIGHTS[obligation.severityTier]
  const timing = TIME_WEIGHTS[obligation.timePressure]
  const relief = obligation.reliefPerDollar
  const negotiability = 1 - obligation.negotiability

  const compositeScore = severity * timing * relief * negotiability

  return { ...obligation, compositeScore }
}

export function scoreObligations(obligations: Obligation[]): ScoredObligation[] {
  return obligations
    .map(scoreObligation)
    .sort((a, b) => b.compositeScore - a.compositeScore)
}
