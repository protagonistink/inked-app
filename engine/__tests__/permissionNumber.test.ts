import { describe, it, expect } from 'vitest'
import { calculatePermissionNumber } from '../permissionNumber'

describe('calculatePermissionNumber', () => {
  it('subtracts all commitments from income', () => {
    const result = calculatePermissionNumber({
      confirmedIncome: 5000,
      survivalCommitments: 2100,
      untouchableCommitments: 450,
      catchUpCommitments: 253,
      spentFromFlexThisCycle: 769,
    })
    expect(result).toBe(1428)
  })

  it('returns zero when commitments exceed income', () => {
    const result = calculatePermissionNumber({
      confirmedIncome: 1000,
      survivalCommitments: 800,
      untouchableCommitments: 200,
      catchUpCommitments: 100,
      spentFromFlexThisCycle: 50,
    })
    expect(result).toBe(0)
  })

  it('is deterministic — same inputs always same output', () => {
    const inputs = {
      confirmedIncome: 5000,
      survivalCommitments: 2100,
      untouchableCommitments: 450,
      catchUpCommitments: 253,
      spentFromFlexThisCycle: 769,
    }
    expect(calculatePermissionNumber(inputs)).toBe(calculatePermissionNumber(inputs))
  })
})
