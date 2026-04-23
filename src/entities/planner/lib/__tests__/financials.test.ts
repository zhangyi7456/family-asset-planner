import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import {
  calculateDashboardMetrics,
  calculateFinancialTotals,
} from '../financials'

describe('financials', () => {
  it('calculates totals from household data', () => {
    const totals = calculateFinancialTotals(defaultHouseholdData)

    expect(totals.totalAssets).toBe(2898000)
    expect(totals.totalLiabilities).toBe(938000)
    expect(totals.netWorth).toBe(1960000)
    expect(totals.monthlyIncome).toBe(73600)
    expect(totals.monthlyExpenses).toBe(43000)
    expect(totals.monthlyFreeCashflow).toBe(30600)
  })

  it('builds dashboard metrics and asset distribution', () => {
    const metrics = calculateDashboardMetrics(defaultHouseholdData)

    expect(metrics.liabilityRatio).toBeCloseTo(32.36714975845411)
    expect(metrics.emergencyCoverageMonths).toBeCloseTo(6.651162790697675)
    expect(metrics.investmentAssetRatio).toBeCloseTo(29.15734989648033)
    expect(metrics.assetDistribution[0]?.name).toBe('房产与长期资产')
    expect(metrics.summaryCards).toHaveLength(6)
  })
})
