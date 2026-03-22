import type { Obligation, RevenueEntry, Transaction } from '../engine/types'

/**
 * Input data for the engine's computeEngineState function.
 * This mirrors the FinancialData interface defined in engine/index.ts.
 */
export interface MockFinancialData {
  obligations: Obligation[]
  revenue: RevenueEntry[]
  transactions: Transaction[]
  income: number
  cashOnHand: number
  flexPoolTarget: number
  spentFromFlex: number
  survivalNeeds: number
  untouchableNeeds: number
  catchUpNeeds: number
  today: Date
}

type Scenario = 'clear' | 'watch' | 'act'

function daysFromNow(days: number, today: Date): Date {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  return d
}

function daysAgo(days: number, today: Date): Date {
  const d = new Date(today)
  d.setDate(d.getDate() - days)
  return d
}

/**
 * CLEAR scenario — calm cognitive state
 *
 * Healthy finances: solid income, manageable obligations,
 * comfortable cash buffer. No past-due bills.
 */
function createClearScenario(today: Date): MockFinancialData {
  const obligations: Obligation[] = [
    {
      id: 'obl-rent',
      name: 'Rent — Maple Creek Apartments',
      amount: 1800,
      dueDate: daysFromNow(10, today),
      severityTier: 'housing_loss',
      timePressure: 'due_this_week',
      reliefPerDollar: 1.0,
      negotiability: 0.1,
      bestAction: 'pay',
      consequenceIfIgnored: 'Late fee + eviction risk',
      cashReserved: 1800,
      isPastDue: false,
      daysUntilDue: 10,
    },
    {
      id: 'obl-car-ins',
      name: 'Progressive Auto Insurance',
      amount: 220,
      dueDate: daysFromNow(14, today),
      severityTier: 'insurance_lapse',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.8,
      negotiability: 0.2,
      bestAction: 'pay',
      consequenceIfIgnored: 'Coverage lapse, SR-22 risk',
      cashReserved: 220,
      isPastDue: false,
      daysUntilDue: 14,
    },
    {
      id: 'obl-phone',
      name: 'Verizon Wireless',
      amount: 85,
      dueDate: daysFromNow(7, today),
      severityTier: 'utility_shutoff',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.7,
      negotiability: 0.3,
      bestAction: 'pay',
      consequenceIfIgnored: 'Service shutoff',
      cashReserved: 85,
      isPastDue: false,
      daysUntilDue: 7,
    },
  ]

  const revenue: RevenueEntry[] = [
    {
      id: 'rev-salary',
      amount: 5000,
      expectedDate: daysFromNow(11, today),
      confidence: 'confirmed',
      sourceType: 'salary',
      unlocks: ['obl-rent', 'obl-car-ins'],
      description: 'Employer direct deposit',
    },
  ]

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      plaidTransactionId: 'plaid-001',
      date: daysAgo(2, today),
      amount: 45.23,
      merchantName: 'Whole Foods Market',
      poolAssignment: 'essentials_flex',
      reviewStatus: 'auto_processed',
      isManual: false,
    },
    {
      id: 'tx-2',
      plaidTransactionId: 'plaid-002',
      date: daysAgo(1, today),
      amount: 74.50,
      merchantName: 'Target',
      poolAssignment: 'essentials_flex',
      reviewStatus: 'auto_processed',
      isManual: false,
    },
  ]

  return {
    obligations,
    revenue,
    transactions,
    income: 5000,
    cashOnHand: 4200,
    flexPoolTarget: 800,
    spentFromFlex: 120,
    survivalNeeds: 2100,
    untouchableNeeds: 450,
    catchUpNeeds: 0,
    today,
  }
}

/**
 * WATCH scenario — alert cognitive state
 *
 * Tighter finances: one past-due bill, a credit card due soon,
 * thinner buffer. Freelance income invoiced but not yet received.
 */
function createWatchScenario(today: Date): MockFinancialData {
  const obligations: Obligation[] = [
    {
      id: 'obl-rent',
      name: 'Rent — Maple Creek Apartments',
      amount: 1800,
      dueDate: daysFromNow(10, today),
      severityTier: 'housing_loss',
      timePressure: 'due_this_week',
      reliefPerDollar: 1.0,
      negotiability: 0.1,
      bestAction: 'pay',
      consequenceIfIgnored: 'Late fee + eviction risk',
      cashReserved: 1800,
      isPastDue: false,
      daysUntilDue: 10,
    },
    {
      id: 'obl-car-ins',
      name: 'Progressive Auto Insurance',
      amount: 220,
      dueDate: daysFromNow(14, today),
      severityTier: 'insurance_lapse',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.8,
      negotiability: 0.2,
      bestAction: 'pay',
      consequenceIfIgnored: 'Coverage lapse, SR-22 risk',
      cashReserved: 220,
      isPastDue: false,
      daysUntilDue: 14,
    },
    {
      id: 'obl-phone',
      name: 'Verizon Wireless',
      amount: 85,
      dueDate: daysFromNow(7, today),
      severityTier: 'utility_shutoff',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.7,
      negotiability: 0.3,
      bestAction: 'pay',
      consequenceIfIgnored: 'Service shutoff',
      cashReserved: 85,
      isPastDue: false,
      daysUntilDue: 7,
    },
    {
      id: 'obl-cc',
      name: 'Chase Sapphire Visa',
      amount: 350,
      dueDate: daysFromNow(3, today),
      severityTier: 'collections_fee_apr',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.5,
      negotiability: 0.4,
      bestAction: 'pay',
      consequenceIfIgnored: 'Late fee + penalty APR',
      cashReserved: 350,
      isPastDue: false,
      daysUntilDue: 3,
    },
    {
      id: 'obl-util-pastdue',
      name: 'Comcast Internet',
      amount: 150,
      dueDate: daysAgo(5, today),
      severityTier: 'utility_shutoff',
      timePressure: 'past_due_stable',
      reliefPerDollar: 0.6,
      negotiability: 0.5,
      bestAction: 'call',
      consequenceIfIgnored: 'Service shutoff + collections',
      cashReserved: 0,
      isPastDue: true,
      daysUntilDue: -5,
    },
  ]

  const revenue: RevenueEntry[] = [
    {
      id: 'rev-salary',
      amount: 4500,
      expectedDate: daysFromNow(11, today),
      confidence: 'confirmed',
      sourceType: 'salary',
      unlocks: ['obl-rent'],
      description: 'Employer direct deposit',
    },
    {
      id: 'rev-freelance',
      amount: 1200,
      expectedDate: daysFromNow(7, today),
      confidence: 'invoiced',
      sourceType: 'freelance',
      unlocks: ['obl-util-pastdue'],
      description: 'Freelance web project — invoiced',
    },
  ]

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      plaidTransactionId: 'plaid-010',
      date: daysAgo(1, today),
      amount: 62.30,
      merchantName: 'Kroger',
      poolAssignment: 'essentials_flex',
      reviewStatus: 'auto_processed',
      isManual: false,
    },
    {
      id: 'tx-w2',
      plaidTransactionId: 'plaid-011',
      date: daysAgo(2, today),
      amount: 89.00,
      merchantName: 'Sushi Nori',
      poolAssignment: 'personal_flex',
      reviewStatus: 'needs_review',
      isManual: false,
    },
    {
      id: 'tx-w3',
      plaidTransactionId: 'plaid-012',
      date: daysAgo(1, today),
      amount: 145.00,
      merchantName: 'Best Buy',
      poolAssignment: 'sinking_fund',
      reviewStatus: 'needs_review',
      isManual: false,
    },
    {
      id: 'tx-w4',
      plaidTransactionId: null,
      date: daysAgo(3, today),
      amount: 52.75,
      merchantName: 'Uber Eats',
      poolAssignment: 'personal_flex',
      reviewStatus: 'needs_review',
      isManual: false,
    },
    {
      id: 'tx-w5',
      plaidTransactionId: 'plaid-013',
      date: daysAgo(1, today),
      amount: 34.50,
      merchantName: 'Chipotle',
      poolAssignment: 'essentials_flex',
      reviewStatus: 'needs_review',
      isManual: false,
    },
  ]

  return {
    obligations,
    revenue,
    transactions,
    income: 4500,
    cashOnHand: 4000,
    flexPoolTarget: 800,
    spentFromFlex: 450,
    survivalNeeds: 2100,
    untouchableNeeds: 450,
    catchUpNeeds: 150,
    today,
  }
}

/**
 * ACT scenario — compressed cognitive state
 *
 * Multiple past-due bills, very thin cash buffer,
 * speculative income that can't be allocated against.
 * Requires immediate triage.
 */
function createActScenario(today: Date): MockFinancialData {
  const obligations: Obligation[] = [
    {
      id: 'obl-rent',
      name: 'Rent — Maple Creek Apartments',
      amount: 1800,
      dueDate: daysAgo(3, today),
      severityTier: 'housing_loss',
      timePressure: 'past_due_escalating',
      reliefPerDollar: 1.0,
      negotiability: 0.1,
      bestAction: 'call',
      consequenceIfIgnored: 'Eviction notice + late fees',
      cashReserved: 0,
      isPastDue: true,
      daysUntilDue: -3,
    },
    {
      id: 'obl-car-ins',
      name: 'Progressive Auto Insurance',
      amount: 397,
      dueDate: daysFromNow(1, today),
      severityTier: 'insurance_lapse',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.8,
      negotiability: 0.2,
      bestAction: 'pay',
      consequenceIfIgnored: 'Coverage lapse tomorrow',
      cashReserved: 0,
      isPastDue: false,
      daysUntilDue: 1,
    },
    {
      id: 'obl-util',
      name: 'Duke Energy Electric',
      amount: 280,
      dueDate: daysAgo(7, today),
      severityTier: 'utility_shutoff',
      timePressure: 'past_due_escalating',
      reliefPerDollar: 0.9,
      negotiability: 0.3,
      bestAction: 'call',
      consequenceIfIgnored: 'Disconnection + reconnect fee',
      cashReserved: 0,
      isPastDue: true,
      daysUntilDue: -7,
    },
    {
      id: 'obl-cc',
      name: 'Capital One Quicksilver',
      amount: 500,
      dueDate: daysAgo(10, today),
      severityTier: 'collections_fee_apr',
      timePressure: 'past_due_stable',
      reliefPerDollar: 0.4,
      negotiability: 0.5,
      bestAction: 'call',
      consequenceIfIgnored: 'Penalty APR + collections',
      cashReserved: 0,
      isPastDue: true,
      daysUntilDue: -10,
    },
    {
      id: 'obl-medical',
      name: 'Riverside Medical Group',
      amount: 150,
      dueDate: daysFromNow(4, today),
      severityTier: 'medical_access',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.6,
      negotiability: 0.7,
      bestAction: 'hardship',
      consequenceIfIgnored: 'Sent to collections',
      cashReserved: 0,
      isPastDue: false,
      daysUntilDue: 4,
    },
  ]

  const revenue: RevenueEntry[] = [
    {
      id: 'rev-freelance',
      amount: 2000,
      expectedDate: daysFromNow(10, today),
      confidence: 'verbal',
      sourceType: 'freelance',
      unlocks: [],
      description: 'Freelance project — verbal agreement only',
    },
    {
      id: 'rev-salary',
      amount: 3000,
      expectedDate: daysFromNow(14, today),
      confidence: 'confirmed',
      sourceType: 'salary',
      unlocks: ['obl-rent'],
      description: 'Employer direct deposit (reduced hours)',
    },
  ]

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      plaidTransactionId: 'plaid-020',
      date: daysAgo(1, today),
      amount: 32.15,
      merchantName: 'Aldi',
      poolAssignment: 'essentials_flex',
      reviewStatus: 'auto_processed',
      isManual: false,
    },
    {
      id: 'tx-2',
      plaidTransactionId: null,
      date: daysAgo(0, today),
      amount: 150.00,
      merchantName: 'Cash withdrawal',
      poolAssignment: 'personal_flex',
      reviewStatus: 'needs_review',
      isManual: true,
    },
    {
      id: 'tx-a3',
      plaidTransactionId: 'plaid-021',
      date: daysAgo(1, today),
      amount: 67.80,
      merchantName: 'DoorDash',
      poolAssignment: 'personal_flex',
      reviewStatus: 'needs_review',
      isManual: false,
    },
    {
      id: 'tx-a4',
      plaidTransactionId: 'plaid-022',
      date: daysAgo(2, today),
      amount: 120.00,
      merchantName: 'Amazon',
      poolAssignment: 'sinking_fund',
      reviewStatus: 'needs_review',
      isManual: false,
    },
  ]

  return {
    obligations,
    revenue,
    transactions,
    income: 3000,
    cashOnHand: 1200,
    flexPoolTarget: 800,
    spentFromFlex: 650,
    survivalNeeds: 2100,
    untouchableNeeds: 450,
    catchUpNeeds: 2580,
    today,
  }
}

/**
 * Creates mock financial data for one of three scenarios.
 *
 * - `'clear'` — Calm state. Healthy buffer, no past-due bills.
 * - `'watch'` — Alert state. One past-due, tighter buffer.
 * - `'act'`   — Compressed state. Multiple past-due, thin cash.
 */
export function createMockFinancialData(scenario: Scenario): MockFinancialData {
  const today = new Date('2026-03-21T12:00:00')

  switch (scenario) {
    case 'clear':
      return createClearScenario(today)
    case 'watch':
      return createWatchScenario(today)
    case 'act':
      return createActScenario(today)
  }
}
