import { describe, it, expect } from 'vitest'
import { computeEngineState } from '../index'
import { createMockFinancialData } from '../../data/mockData'

describe('computeEngineState', () => {
  it('produces a complete EngineState from clear scenario', () => {
    const data = createMockFinancialData('clear')
    const state = computeEngineState(data)

    expect(state.permissionNumber).toBeGreaterThan(0)
    expect(state.cognitiveState).toBe('calm')
    expect(state.cashJobs.permissionNumber).toBe(state.permissionNumber)
    expect(state.obligations.length).toBeGreaterThan(0)
    expect(state.recommendations.length).toBeLessThanOrEqual(3)
    expect(state.bridgeNodes.length).toBeGreaterThan(0)
  })

  it('produces compressed state for act scenario', () => {
    const data = createMockFinancialData('act')
    const state = computeEngineState(data)

    expect(state.cognitiveState).toBe('compressed')
    expect(state.recommendations.length).toBeGreaterThan(0)
  })

  it('produces alert state for watch scenario', () => {
    const data = createMockFinancialData('watch')
    const state = computeEngineState(data)

    expect(state.cognitiveState).toBe('alert')
  })
})
