import { describe, it, expect } from 'vitest'
import { allocateCashJobs } from '../cashJobsAllocator'

describe('allocateCashJobs', () => {
  it('distributes cash into five buckets', () => {
    const jobs = allocateCashJobs({
      totalCash: 3631,
      survivalNeeds: 2100,
      untouchableNeeds: 450,
      catchUpNeeds: 253,
      flexPoolTarget: 800,
      spentFromFlex: 120,
    })
    expect(jobs.survival).toBe(2100)
    expect(jobs.untouchable).toBe(450)
    expect(jobs.catchUp).toBe(253)
    expect(jobs.operating).toBe(680)
    expect(jobs.trulyFree).toBe(148)
  })

  it('permission number equals operating + truly free', () => {
    const jobs = allocateCashJobs({
      totalCash: 3631,
      survivalNeeds: 2100,
      untouchableNeeds: 450,
      catchUpNeeds: 253,
      flexPoolTarget: 800,
      spentFromFlex: 120,
    })
    expect(jobs.permissionNumber).toBe(jobs.operating + jobs.trulyFree)
  })

  it('handles insufficient cash — prioritizes survival', () => {
    const jobs = allocateCashJobs({
      totalCash: 1500,
      survivalNeeds: 2100,
      untouchableNeeds: 450,
      catchUpNeeds: 253,
      flexPoolTarget: 800,
      spentFromFlex: 0,
    })
    expect(jobs.survival).toBe(1500)
    expect(jobs.operating).toBe(0)
    expect(jobs.trulyFree).toBe(0)
    expect(jobs.permissionNumber).toBe(0)
  })
})
