import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculatePortfolioLinkage,
  calculatePortfolioPositions,
} from '../portfolio'

describe('portfolio', () => {
  it('calculates linkage metrics from household assets and cashflow', () => {
    const linkage = calculatePortfolioLinkage(defaultHouseholdData, 30600)

    expect(linkage.investableAssets).toBeCloseTo(1097600)
    expect(linkage.portfolioTrackedValue).toBeCloseTo(484600)
    expect(linkage.portfolioCoverageRatio).toBeCloseTo(57.349112426035504)
    expect(linkage.growthTargetRatio).toBe(45)
  })

  it('calculates aggregated position metrics', () => {
    const positions = calculatePortfolioPositions(defaultHouseholdData)

    expect(positions.totalMarketValue).toBeCloseTo(484600)
    expect(positions.totalNetProfit).toBeCloseTo(36770)
    expect(positions.totalTargetWeight).toBe(85)
    expect(positions.largestPositionCode).toBe('159941')
  })
})
