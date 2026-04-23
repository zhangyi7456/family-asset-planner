import { describe, expect, it } from 'vitest'
import { defaultExpenses } from '../../data/seed'
import {
  calculateBudgetAssessment,
  createRecommendedBudgetCaps,
} from '../budget'

describe('budget', () => {
  it('creates recommended caps based on monthly income', () => {
    const caps = createRecommendedBudgetCaps(50000)

    expect(caps).toEqual({
      living: 14000,
      housing: 18000,
      education: 7000,
      insurance: 4000,
      medical: 3000,
      other: 4000,
    })
  })

  it('detects overspend and highest pressure category', () => {
    const caps = {
      living: 12000,
      housing: 14000,
      education: 5000,
      insurance: 3000,
      medical: 3000,
      other: 2000,
    }

    const result = calculateBudgetAssessment(defaultExpenses, caps)

    expect(result.totalActual).toBe(43000)
    expect(result.totalOverspend).toBe(9000)
    expect(result.highestPressureCategory?.category).toBe('living')
    expect(result.categories[0]?.category).toBe('living')
  })
})
