import { createContext, type ChangeEvent } from 'react'
import { calculateDashboardMetrics } from '../lib/financials'
import type {
  Asset,
  ExpenseRecord,
  GoalPlan,
  HouseholdData,
  IncomeRecord,
  InvestmentPosition,
  Liability,
  TaskCompletionSource,
} from '../types/planner'

export interface NewAssetInput {
  name: string
  category: Asset['category']
  amount: number
  notes?: string
}

export interface NewLiabilityInput {
  name: string
  category: Liability['category']
  amount: number
  notes?: string
}

export interface NewIncomeInput {
  name: string
  category: IncomeRecord['category']
  monthlyAmount: number
}

export interface NewExpenseInput {
  name: string
  category: ExpenseRecord['category']
  monthlyAmount: number
}

export interface NewGoalInput {
  title: string
  category: GoalPlan['category']
  targetAmount: number
  currentAmount: number
  targetDate: string
  notes?: string
}

export interface UpdateProfileInput {
  familyName: string
  members: number
  monthlyTargetSavings: number
  riskProfile: string
}

export interface NewInvestmentPositionInput {
  code: string
  name: string
  assetType: InvestmentPosition['assetType']
  costPrice: number
  quantity: number
  latestPrice: number
  targetWeight: number
  accumulatedDividend: number
  totalFees: number
  notes?: string
}

export interface PlannerDataContextValue {
  data: HouseholdData
  metrics: ReturnType<typeof calculateDashboardMetrics>
  addAsset: (input: NewAssetInput) => void
  updateAsset: (id: string, input: NewAssetInput) => void
  removeAsset: (id: string) => void
  addLiability: (input: NewLiabilityInput) => void
  updateLiability: (id: string, input: NewLiabilityInput) => void
  removeLiability: (id: string) => void
  addIncome: (input: NewIncomeInput) => void
  updateIncome: (id: string, input: NewIncomeInput) => void
  removeIncome: (id: string) => void
  addExpense: (input: NewExpenseInput) => void
  updateExpense: (id: string, input: NewExpenseInput) => void
  removeExpense: (id: string) => void
  addGoal: (input: NewGoalInput) => void
  updateGoal: (id: string, input: NewGoalInput) => void
  removeGoal: (id: string) => void
  addInvestmentPosition: (input: NewInvestmentPositionInput) => void
  addInvestmentPositionsBatch: (inputs: NewInvestmentPositionInput[]) => void
  updateInvestmentPosition: (id: string, input: NewInvestmentPositionInput) => void
  removeInvestmentPosition: (id: string) => void
  updateProfile: (input: UpdateProfileInput) => void
  importData: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  importValidatedData: (nextData: HouseholdData) => void
  recordAlert: (message: string) => void
  markTaskComplete: (task: string, source: TaskCompletionSource) => void
  clearTaskCompletion: (task: string) => void
  exportData: () => void
  clearData: () => void
  resetData: () => void
}

export const PlannerDataContext = createContext<PlannerDataContextValue | null>(null)
