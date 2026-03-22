import type {
  Obligation,
  RevenueEntry,
  Transaction,
  EngineState,
  CognitiveState,
} from './types'
import { scoreObligations } from './consequenceScorer'
import { allocateCashJobs } from './cashJobsAllocator'
import { calculatePermissionNumber } from './permissionNumber'
import { filterAllocatableRevenue } from './revenueTracker'
import { buildBridge } from './timePressureMapper'
import { generateRecommendations } from './recommendationEngine'
import { inferCognitiveState } from './cognitiveStateInferrer'
import { detectRecoveryStage } from './recoveryStageDetector'

/**
 * The contract between the data layer and the engine.
 * All monetary values are in dollars. Dates use JS Date objects.
 */
export interface FinancialData {
  /** All known obligations (bills, debts, commitments) */
  obligations: Obligation[]
  /** Expected revenue entries (salary, freelance, etc.) */
  revenue: RevenueEntry[]
  /** Recent transactions to classify */
  transactions: Transaction[]
  /** Total confirmed monthly income */
  income: number
  /** Current cash on hand across all accounts */
  cashOnHand: number
  /** Target amount for the flex spending pool */
  flexPoolTarget: number
  /** Amount already spent from the flex pool this cycle */
  spentFromFlex: number
  /** Minimum survival needs (rent, food, utilities) */
  survivalNeeds: number
  /** Reserve that must not be touched */
  untouchableNeeds: number
  /** Amount needed to catch up on past-due items */
  catchUpNeeds: number
  /** Reference date for all calculations */
  today: Date
}

/**
 * Orchestrates all engine modules to produce a complete EngineState.
 *
 * Pipeline:
 * 1. Score and rank obligations by consequence severity
 * 2. Detect recovery stage from financial indicators
 * 3. Calculate permission number (what you can safely spend)
 * 4. Allocate cash into job buckets
 * 5. Build a 14-day forward-looking bridge
 * 6. Generate top-3 prioritized recommendations
 * 7. Infer cognitive state (calm / alert / compressed)
 * 8. Process transactions through auto-classification
 * 9. Return the complete engine state
 */
export function computeEngineState(data: FinancialData): EngineState {
  // 1. Score obligations
  const scoredObligations = scoreObligations(data.obligations)

  // 2. Detect recovery stage
  const pastDueCount = data.obligations.filter(o => o.isPastDue).length
  const totalObligationAmount = data.obligations.reduce((sum, o) => sum + o.amount, 0)
  const bufferAmount = data.cashOnHand - totalObligationAmount

  const recoveryStage = detectRecoveryStage({
    pastDueCount,
    bufferAmount: Math.max(0, bufferAmount),
    monthlyObligations: totalObligationAmount,
    hasRecentIncomeInterruption: false,
    debtToIncomeRatio: totalObligationAmount / Math.max(data.income, 1),
  })

  // 3. Calculate permission number
  const permissionNumber = calculatePermissionNumber({
    confirmedIncome: data.income,
    survivalCommitments: data.survivalNeeds,
    untouchableCommitments: data.untouchableNeeds,
    catchUpCommitments: data.catchUpNeeds,
    spentFromFlexThisCycle: data.spentFromFlex,
  })

  // 4. Allocate cash jobs
  const cashJobs = allocateCashJobs({
    totalCash: data.cashOnHand,
    survivalNeeds: data.survivalNeeds,
    untouchableNeeds: data.untouchableNeeds,
    catchUpNeeds: data.catchUpNeeds,
    flexPoolTarget: data.flexPoolTarget,
    spentFromFlex: data.spentFromFlex,
  })

  // 5. Build 14-day bridge
  const allocatableRevenue = filterAllocatableRevenue(data.revenue)
  const bridgeNodes = buildBridge(data.obligations, allocatableRevenue, data.today, 14)

  // 6. Generate recommendations
  const recommendations = generateRecommendations(
    scoredObligations,
    cashJobs.permissionNumber,
  )

  // 7. Infer cognitive state
  const actLevelItemCount = data.obligations.filter(
    o => o.timePressure === 'due_today' || o.timePressure === 'past_due_escalating'
  ).length

  // Estimate days until cash goes negative by walking the bridge
  let runningCash = data.cashOnHand
  let daysUntilCashNegative = 30 // default: safe
  for (const node of bridgeNodes) {
    runningCash += node.netEffect
    if (runningCash < 0) {
      const diffMs = node.date.getTime() - data.today.getTime()
      daysUntilCashNegative = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
      break
    }
  }

  const bufferToObligationRatio = totalObligationAmount > 0
    ? data.cashOnHand / totalObligationAmount
    : 10 // no obligations = very safe

  const cognitiveState: CognitiveState = inferCognitiveState({
    recoveryStage,
    pastDueCount,
    bufferToObligationRatio,
    actLevelItemCount,
    daysUntilCashNegative,
    reviewQueueDepth: 0,
  })

  // 8. Skip transaction processing — Inked uses aggregated category spend, not individual transactions
  const reviewQueue: Transaction[] = []

  // 9. Assemble and return complete engine state
  return {
    permissionNumber: cashJobs.permissionNumber,
    cashJobs,
    cognitiveState,
    recoveryStage,
    obligations: scoredObligations,
    recommendations,
    bridgeNodes,
    revenue: data.revenue,
    reviewQueue,
  }
}
