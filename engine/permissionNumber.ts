export interface PermissionNumberInputs {
  confirmedIncome: number
  survivalCommitments: number
  untouchableCommitments: number
  catchUpCommitments: number
  spentFromFlexThisCycle: number
}

export function calculatePermissionNumber(inputs: PermissionNumberInputs): number {
  const result =
    inputs.confirmedIncome
    - inputs.survivalCommitments
    - inputs.untouchableCommitments
    - inputs.catchUpCommitments
    - inputs.spentFromFlexThisCycle

  return Math.max(0, result)
}
