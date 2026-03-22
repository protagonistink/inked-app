import type { CashJobs } from './types'

export interface CashJobsInputs {
  totalCash: number
  survivalNeeds: number
  untouchableNeeds: number
  catchUpNeeds: number
  flexPoolTarget: number
  spentFromFlex: number
}

export function allocateCashJobs(inputs: CashJobsInputs): CashJobs {
  let remaining = inputs.totalCash

  const survival = Math.min(remaining, inputs.survivalNeeds)
  remaining -= survival

  const untouchable = Math.min(remaining, inputs.untouchableNeeds)
  remaining -= untouchable

  const catchUp = Math.min(remaining, inputs.catchUpNeeds)
  remaining -= catchUp

  const operatingTarget = Math.max(0, inputs.flexPoolTarget - inputs.spentFromFlex)
  const operating = Math.min(remaining, operatingTarget)
  remaining -= operating

  const trulyFree = remaining

  const total = survival + operating + catchUp + untouchable + trulyFree

  return {
    survival,
    operating,
    catchUp,
    untouchable,
    trulyFree,
    total,
    permissionNumber: operating + trulyFree,
  }
}
