export type SeverityTier =
  | 'housing_loss'
  | 'utility_shutoff'
  | 'insurance_lapse'
  | 'transportation'
  | 'medical_access'
  | 'collections_fee_apr'
  | 'annoyance_reputational'

export type TimePressure =
  | 'due_today'
  | 'due_this_week'
  | 'past_due_escalating'
  | 'past_due_stable'
  | 'flexible_if_contacted'
  | 'inflexible_if_missed'

export type ActionType = 'pay' | 'call' | 'split' | 'hardship' | 'defer' | 'ignore'

export type ConfidenceLevel = 'confirmed' | 'invoiced' | 'verbal' | 'speculative'

export type CognitiveState = 'calm' | 'alert' | 'compressed'

export type RecoveryStage =
  | 'stable'
  | 'tight'
  | 'triage'
  | 'arrears_recovery'
  | 'income_interruption'
  | 'rebuild'

export type PoolAssignment = 'essentials_flex' | 'personal_flex' | 'fixed' | 'sinking_fund'

export type ReviewStatus = 'auto_processed' | 'needs_review' | 'parked' | 'confirmed'

export interface Obligation {
  id: string
  name: string
  amount: number
  dueDate: Date
  severityTier: SeverityTier
  timePressure: TimePressure
  reliefPerDollar: number
  negotiability: number
  bestAction: ActionType
  consequenceIfIgnored: string
  cashReserved: number
  isPastDue: boolean
  daysUntilDue: number
}

export interface CashJobs {
  survival: number
  operating: number
  catchUp: number
  untouchable: number
  trulyFree: number
  total: number
  permissionNumber: number
}

export interface RevenueEntry {
  id: string
  amount: number
  expectedDate: Date
  confidence: ConfidenceLevel
  sourceType: string
  unlocks: string[]
  description: string
}

export interface Recommendation {
  id: string
  actionVerb: ActionType
  target: string
  amount: number
  protects: string
  exposesAfter: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  rank: number
}

export interface BridgeNode {
  date: Date
  eventType: 'bill' | 'income' | 'sinking_fund'
  name: string
  amount: number
  netEffect: number
  consequenceTier: SeverityTier | null
}

export interface Transaction {
  id: string
  plaidTransactionId: string | null
  date: Date
  amount: number
  merchantName: string
  poolAssignment: PoolAssignment
  reviewStatus: ReviewStatus
  isManual: boolean
}

export interface EngineState {
  permissionNumber: number
  cashJobs: CashJobs
  cognitiveState: CognitiveState
  recoveryStage: RecoveryStage
  obligations: Obligation[]
  recommendations: Recommendation[]
  bridgeNodes: BridgeNode[]
  revenue: RevenueEntry[]
  reviewQueue: Transaction[]
}
