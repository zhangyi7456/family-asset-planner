import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculateDashboardMetrics,
  calculateFinancialTotals,
} from '../financials'

describe('financials', () => {
  it('calculates totals from household data', () => {
    const totals = calculateFinancialTotals(defaultHouseholdData)

    expect(totals.totalAssets).toBe(5116300)
    expect(totals.totalLiabilities).toBe(1203600)
    expect(totals.netWorth).toBe(3912700)
    expect(totals.monthlyIncome).toBe(120000)
    expect(totals.monthlyExpenses).toBe(81300)
    expect(totals.monthlyFreeCashflow).toBe(38700)
  })

  it('builds dashboard metrics and asset distribution', () => {
    const metrics = calculateDashboardMetrics(defaultHouseholdData)

    expect(metrics.liabilityRatio).toBeCloseTo(23.524813, 5)
    expect(metrics.emergencyCoverageMonths).toBeCloseTo(6.252153, 5)
    expect(metrics.investmentAssetRatio).toBeCloseTo(29.396243, 5)
    expect(metrics.assetDistribution[0]?.name).toBe('房产与长期资产')
    expect(metrics.summaryCards).toHaveLength(6)
  })
})
