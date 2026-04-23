import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculateDashboardMetrics,
  calculateFinancialTotals,
} from '../financials'

describe('financials', () => {
  it('calculates totals from household data', () => {
    const totals = calculateFinancialTotals(defaultHouseholdData)

    expect(totals.totalAssets).toBe(4474300)
    expect(totals.totalLiabilities).toBe(1134600)
    expect(totals.netWorth).toBe(3339700)
    expect(totals.monthlyIncome).toBe(111600)
    expect(totals.monthlyExpenses).toBe(73300)
    expect(totals.monthlyFreeCashflow).toBe(38300)
  })

  it('builds dashboard metrics and asset distribution', () => {
    const metrics = calculateDashboardMetrics(defaultHouseholdData)

    expect(metrics.liabilityRatio).toBeCloseTo(25.358157, 5)
    expect(metrics.emergencyCoverageMonths).toBeCloseTo(5.188267, 5)
    expect(metrics.investmentAssetRatio).toBeCloseTo(26.149342, 5)
    expect(metrics.assetDistribution[0]?.name).toBe('房产与长期资产')
    expect(metrics.summaryCards).toHaveLength(6)
  })
})
