import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculatePortfolioLinkage,
  calculatePortfolioPositions,
} from '../portfolio'

describe('portfolio', () => {
  it('calculates linkage metrics from household assets and cashflow', () => {
    const linkage = calculatePortfolioLinkage(defaultHouseholdData, 38300)

    expect(linkage.investableAssets).toBeCloseTo(2075170)
    expect(linkage.portfolioTrackedValue).toBeCloseTo(1062870)
    expect(linkage.portfolioCoverageRatio).toBeCloseTo(90.84358974358975)
    expect(linkage.growthTargetRatio).toBe(45)
  })

  it('calculates aggregated position metrics', () => {
    const positions = calculatePortfolioPositions(defaultHouseholdData)

    expect(positions.totalMarketValue).toBeCloseTo(1062870)
    expect(positions.totalNetProfit).toBeCloseTo(92593.2)
    expect(positions.totalTargetWeight).toBe(100)
    expect(positions.largestPositionCode).toBe('512890')
  })
})
