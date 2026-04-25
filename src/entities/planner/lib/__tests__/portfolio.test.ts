import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculatePortfolioLinkage,
  calculatePortfolioPositions,
} from '../portfolio'

describe('portfolio', () => {
  it('calculates linkage metrics from household assets and cashflow', () => {
    const linkage = calculatePortfolioLinkage(defaultHouseholdData, 38700)

    expect(linkage.investableAssets).toBeCloseTo(2763333.6)
    expect(linkage.portfolioTrackedValue).toBeCloseTo(1443033.6)
    expect(linkage.portfolioCoverageRatio).toBeCloseTo(95.946383, 5)
    expect(linkage.growthTargetRatio).toBe(45)
  })

  it('calculates aggregated position metrics', () => {
    const positions = calculatePortfolioPositions(defaultHouseholdData)

    expect(positions.totalMarketValue).toBeCloseTo(1443033.6)
    expect(positions.totalNetProfit).toBeCloseTo(116881.6)
    expect(positions.totalTargetWeight).toBe(100)
    expect(positions.largestPositionCode).toBe('512890')
  })
})
