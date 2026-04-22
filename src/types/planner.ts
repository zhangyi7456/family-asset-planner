export type AssetCategory = 'cash' | 'investment' | 'housing' | 'insurance' | 'other'

export type LiabilityCategory = 'mortgage' | 'consumer' | 'auto' | 'other'

export type IncomeCategory = 'salary' | 'bonus' | 'investment' | 'other'

export type ExpenseCategory =
  | 'living'
  | 'housing'
  | 'education'
  | 'insurance'
  | 'medical'
  | 'other'

export type GoalCategory =
  | 'housing'
  | 'education'
  | 'retirement'
  | 'emergency'
  | 'other'

export type ActivityArea =
  | 'assets'
  | 'liabilities'
  | 'cashflow'
  | 'goals'
  | 'system'

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'reset'
  | 'alert'

export interface HouseholdProfile {
  familyName: string
  members: number
  monthlyTargetSavings: number
  riskProfile: string
}

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  amount: number
  notes?: string
}

export interface Liability {
  id: string
  name: string
  category: LiabilityCategory
  amount: number
  notes?: string
}

export interface IncomeRecord {
  id: string
  name: string
  category: IncomeCategory
  monthlyAmount: number
}

export interface ExpenseRecord {
  id: string
  name: string
  category: ExpenseCategory
  monthlyAmount: number
}

export interface GoalPlan {
  id: string
  title: string
  category: GoalCategory
  targetAmount: number
  currentAmount: number
  targetDate: string
  notes?: string
}

export interface ActivityLogEntry {
  id: string
  timestamp: string
  message: string
  area: ActivityArea
  action: ActivityAction
}

export interface FinancialSnapshot {
  id: string
  timestamp: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyFreeCashflow: number
}

export interface HouseholdData {
  profile: HouseholdProfile
  assets: Asset[]
  liabilities: Liability[]
  incomes: IncomeRecord[]
  expenses: ExpenseRecord[]
  goals: GoalPlan[]
  activityLog: ActivityLogEntry[]
  snapshotHistory: FinancialSnapshot[]
  updatedAt: string
}

export interface PersistedPlannerSnapshot {
  version: number
  data: HouseholdData
}

export interface DistributionItem {
  name: string
  amount: number
  ratio: number
  tone: AssetCategory
}

export interface SummaryItem {
  title: string
  description: string
  value: number
  format: 'currency' | 'percent' | 'months'
}

export interface GoalProgress {
  id: string
  title: string
  description: string
  progress: number
}

export interface DashboardMetrics {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyFreeCashflow: number
  liabilityRatio: number
  emergencyCoverageMonths: number
  investmentAssetRatio: number
  yearlySavingsProgress: number
  goalReadiness: number
  assetDistribution: DistributionItem[]
  summaryCards: SummaryItem[]
  goalProgress: GoalProgress[]
}
