import { describe, expect, it } from 'vitest'
import { defaultHouseholdData } from '../../data/seed'
import { createDiagnosisReport } from '../diagnosis'

describe('diagnosis', () => {
  it('creates a stable report for seeded household data', () => {
    const report = createDiagnosisReport(defaultHouseholdData)

    expect(report.grade).toBe('B')
    expect(report.overallScore).toBeGreaterThanOrEqual(70)
    expect(report.dimensions).toHaveLength(5)
    expect(report.signals[0]?.title).toBe('应急资金不足')
    expect(report.signals.some((item) => item.title === '目标仓位未闭合')).toBe(false)
    expect(report.actions[0]?.href).toContain('/cashflow')
    expect(report.actions.some((item) => item.href.includes('/cashflow'))).toBe(true)
  })

  it('raises a high-priority cashflow signal when expenses exceed income', () => {
    const stressedData = {
      ...defaultHouseholdData,
      expenses: defaultHouseholdData.expenses.map((item, index) =>
        index === 0
          ? {
              ...item,
              monthlyAmount: item.monthlyAmount + 50000,
            }
          : item,
      ),
    }

    const report = createDiagnosisReport(stressedData)
    const cashflowSignal = report.signals.find((item) => item.title === '现金流为负')

    expect(cashflowSignal?.priority).toBe('high')
    expect(cashflowSignal?.href).toContain('/cashflow')
  })
})
