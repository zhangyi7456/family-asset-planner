import { expenseCategoryLabels } from './labels'
import type { ExpenseCategory, ExpenseRecord } from '../types/planner'

export const EXPENSE_BUDGET_STORAGE_KEY = 'family-asset-planner:expense-budgets:v1'

export type ExpenseBudgetCaps = Record<ExpenseCategory, number>

interface BudgetCategoryAssessment {
  category: ExpenseCategory
  label: string
  cap: number
  actual: number
  overspend: number
  usageRate: number
}

export interface BudgetAssessmentResult {
  totalCap: number
  totalActual: number
  totalOverspend: number
  highestPressureCategory: BudgetCategoryAssessment | null
  categories: BudgetCategoryAssessment[]
}

const defaultCategoryRatios: Record<ExpenseCategory, number> = {
  living: 28,
  housing: 36,
  education: 14,
  insurance: 8,
  medical: 6,
  other: 8,
}

function toFinite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function roundAmount(value: number) {
  return Math.round(value / 100) * 100
}

function withFallbackCaps(
  input: Partial<ExpenseBudgetCaps>,
  fallback: ExpenseBudgetCaps,
): ExpenseBudgetCaps {
  return {
    living: toFinite(input.living) ?? fallback.living,
    housing: toFinite(input.housing) ?? fallback.housing,
    education: toFinite(input.education) ?? fallback.education,
    insurance: toFinite(input.insurance) ?? fallback.insurance,
    medical: toFinite(input.medical) ?? fallback.medical,
    other: toFinite(input.other) ?? fallback.other,
  }
}

export function createRecommendedBudgetCaps(monthlyIncome: number): ExpenseBudgetCaps {
  const baseIncome = Number.isFinite(monthlyIncome) && monthlyIncome > 0 ? monthlyIncome : 50000

  return {
    living: roundAmount((baseIncome * defaultCategoryRatios.living) / 100),
    housing: roundAmount((baseIncome * defaultCategoryRatios.housing) / 100),
    education: roundAmount((baseIncome * defaultCategoryRatios.education) / 100),
    insurance: roundAmount((baseIncome * defaultCategoryRatios.insurance) / 100),
    medical: roundAmount((baseIncome * defaultCategoryRatios.medical) / 100),
    other: roundAmount((baseIncome * defaultCategoryRatios.other) / 100),
  }
}

export function loadExpenseBudgetCaps(monthlyIncome: number): ExpenseBudgetCaps {
  const fallback = createRecommendedBudgetCaps(monthlyIncome)
  if (typeof window === 'undefined') {
    return fallback
  }

  const raw = window.localStorage.getItem(EXPENSE_BUDGET_STORAGE_KEY)
  if (!raw) {
    return fallback
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExpenseBudgetCaps>
    return withFallbackCaps(parsed, fallback)
  } catch {
    return fallback
  }
}

export function saveExpenseBudgetCaps(caps: ExpenseBudgetCaps) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(EXPENSE_BUDGET_STORAGE_KEY, JSON.stringify(caps))
}

export function calculateBudgetAssessment(
  expenses: ExpenseRecord[],
  caps: ExpenseBudgetCaps,
): BudgetAssessmentResult {
  const actualMap = expenses.reduce<Record<ExpenseCategory, number>>(
    (accumulator, item) => {
      accumulator[item.category] += item.monthlyAmount
      return accumulator
    },
    {
      living: 0,
      housing: 0,
      education: 0,
      insurance: 0,
      medical: 0,
      other: 0,
    },
  )

  const categories: BudgetCategoryAssessment[] = (
    Object.keys(caps) as ExpenseCategory[]
  ).map((category) => {
    const cap = Math.max(caps[category], 0)
    const actual = actualMap[category]
    const overspend = Math.max(actual - cap, 0)
    const usageRate = cap > 0 ? (actual / cap) * 100 : actual > 0 ? 999 : 0

    return {
      category,
      label: expenseCategoryLabels[category],
      cap,
      actual,
      overspend,
      usageRate,
    }
  })

  const totalCap = categories.reduce((total, item) => total + item.cap, 0)
  const totalActual = categories.reduce((total, item) => total + item.actual, 0)
  const totalOverspend = categories.reduce((total, item) => total + item.overspend, 0)
  const highestPressureCategory = categories.reduce<BudgetCategoryAssessment | null>(
    (current, item) => {
      if (!current) {
        return item
      }

      const currentScore = current.overspend > 0 ? current.overspend : current.usageRate
      const nextScore = item.overspend > 0 ? item.overspend : item.usageRate
      return nextScore > currentScore ? item : current
    },
    null,
  )

  return {
    totalCap,
    totalActual,
    totalOverspend,
    highestPressureCategory,
    categories: categories.toSorted((left, right) => right.usageRate - left.usageRate),
  }
}
