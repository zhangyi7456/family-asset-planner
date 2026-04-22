import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type PropsWithChildren,
} from 'react'
import {
  calculateDashboardMetrics,
  createFinancialSnapshot,
} from '../lib/financials'
import {
  loadHouseholdData,
  PLANNER_DATA_VERSION,
  resetHouseholdData,
  saveHouseholdData,
} from '../lib/storage'
import { validateHouseholdData } from '../lib/validation'
import type {
  ActivityLogEntry,
  Asset,
  ExpenseRecord,
  GoalPlan,
  HouseholdData,
  IncomeRecord,
  Liability,
} from '../types/planner'

interface NewAssetInput {
  name: string
  category: Asset['category']
  amount: number
  notes?: string
}

interface NewLiabilityInput {
  name: string
  category: Liability['category']
  amount: number
  notes?: string
}

interface NewIncomeInput {
  name: string
  category: IncomeRecord['category']
  monthlyAmount: number
}

interface NewExpenseInput {
  name: string
  category: ExpenseRecord['category']
  monthlyAmount: number
}

interface NewGoalInput {
  title: string
  category: GoalPlan['category']
  targetAmount: number
  currentAmount: number
  targetDate: string
  notes?: string
}

interface PlannerDataContextValue {
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
  importData: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  importValidatedData: (nextData: HouseholdData) => void
  recordAlert: (message: string) => void
  exportData: () => void
  resetData: () => void
}

const PlannerDataContext = createContext<PlannerDataContextValue | null>(null)
const MAX_ACTIVITY_LOG = 40
const MAX_SNAPSHOT_HISTORY = 24

function createActivityId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function appendSnapshot(data: HouseholdData, timestamp: string) {
  return [...data.snapshotHistory, createFinancialSnapshot(data, timestamp)].slice(
    -MAX_SNAPSHOT_HISTORY,
  )
}

function withActivity(
  data: HouseholdData,
  activity: Omit<ActivityLogEntry, 'id' | 'timestamp'>,
  options?: {
    withSnapshot?: boolean
  },
): HouseholdData {
  const now = new Date().toISOString()
  const entry: ActivityLogEntry = {
    id: createActivityId(),
    timestamp: now,
    ...activity,
  }

  const nextData = {
    ...data,
    updatedAt: now,
    activityLog: [entry, ...data.activityLog].slice(0, MAX_ACTIVITY_LOG),
  }

  const shouldAppendSnapshot = options?.withSnapshot ?? true
  if (!shouldAppendSnapshot) {
    return nextData
  }

  return {
    ...nextData,
    snapshotHistory: appendSnapshot(nextData, now),
  }
}

export function PlannerDataProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<HouseholdData>(() => loadHouseholdData())

  useEffect(() => {
    saveHouseholdData(data)
  }, [data])

  const metrics = useMemo(() => calculateDashboardMetrics(data), [data])

  function addAsset(input: NewAssetInput) {
    const asset: Asset = {
      id: createRecordId('asset'),
      name: input.name.trim(),
      category: input.category,
      amount: input.amount,
      notes: input.notes?.trim(),
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          assets: [...current.assets, asset],
        },
        { area: 'assets', action: 'create', message: `新增资产：${asset.name}` },
      ),
    )
  }

  function updateAsset(id: string, input: NewAssetInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          assets: current.assets.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: input.name.trim(),
                  category: input.category,
                  amount: input.amount,
                  notes: input.notes?.trim(),
                }
              : item,
          ),
        },
        { area: 'assets', action: 'update', message: `更新资产：${input.name.trim()}` },
      ),
    )
  }

  function removeAsset(id: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          assets: current.assets.filter((item) => item.id !== id),
        },
        { area: 'assets', action: 'delete', message: '删除一条资产记录' },
      ),
    )
  }

  function addLiability(input: NewLiabilityInput) {
    const liability: Liability = {
      id: createRecordId('liability'),
      name: input.name.trim(),
      category: input.category,
      amount: input.amount,
      notes: input.notes?.trim(),
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          liabilities: [...current.liabilities, liability],
        },
        {
          area: 'liabilities',
          action: 'create',
          message: `新增负债：${liability.name}`,
        },
      ),
    )
  }

  function updateLiability(id: string, input: NewLiabilityInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          liabilities: current.liabilities.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: input.name.trim(),
                  category: input.category,
                  amount: input.amount,
                  notes: input.notes?.trim(),
                }
              : item,
          ),
        },
        {
          area: 'liabilities',
          action: 'update',
          message: `更新负债：${input.name.trim()}`,
        },
      ),
    )
  }

  function removeLiability(id: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          liabilities: current.liabilities.filter((item) => item.id !== id),
        },
        { area: 'liabilities', action: 'delete', message: '删除一条负债记录' },
      ),
    )
  }

  function addIncome(input: NewIncomeInput) {
    const income: IncomeRecord = {
      id: createRecordId('income'),
      name: input.name.trim(),
      category: input.category,
      monthlyAmount: input.monthlyAmount,
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          incomes: [...current.incomes, income],
        },
        { area: 'cashflow', action: 'create', message: `新增收入：${income.name}` },
      ),
    )
  }

  function updateIncome(id: string, input: NewIncomeInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          incomes: current.incomes.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: input.name.trim(),
                  category: input.category,
                  monthlyAmount: input.monthlyAmount,
                }
              : item,
          ),
        },
        { area: 'cashflow', action: 'update', message: `更新收入：${input.name.trim()}` },
      ),
    )
  }

  function removeIncome(id: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          incomes: current.incomes.filter((item) => item.id !== id),
        },
        { area: 'cashflow', action: 'delete', message: '删除一条收入记录' },
      ),
    )
  }

  function addExpense(input: NewExpenseInput) {
    const expense: ExpenseRecord = {
      id: createRecordId('expense'),
      name: input.name.trim(),
      category: input.category,
      monthlyAmount: input.monthlyAmount,
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          expenses: [...current.expenses, expense],
        },
        { area: 'cashflow', action: 'create', message: `新增支出：${expense.name}` },
      ),
    )
  }

  function updateExpense(id: string, input: NewExpenseInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          expenses: current.expenses.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name: input.name.trim(),
                  category: input.category,
                  monthlyAmount: input.monthlyAmount,
                }
              : item,
          ),
        },
        { area: 'cashflow', action: 'update', message: `更新支出：${input.name.trim()}` },
      ),
    )
  }

  function removeExpense(id: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          expenses: current.expenses.filter((item) => item.id !== id),
        },
        { area: 'cashflow', action: 'delete', message: '删除一条支出记录' },
      ),
    )
  }

  function addGoal(input: NewGoalInput) {
    const goal: GoalPlan = {
      id: createRecordId('goal'),
      title: input.title.trim(),
      category: input.category,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount,
      targetDate: input.targetDate,
      notes: input.notes?.trim(),
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          goals: [...current.goals, goal],
        },
        { area: 'goals', action: 'create', message: `新增目标：${goal.title}` },
      ),
    )
  }

  function updateGoal(id: string, input: NewGoalInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          goals: current.goals.map((item) =>
            item.id === id
              ? {
                  ...item,
                  title: input.title.trim(),
                  category: input.category,
                  targetAmount: input.targetAmount,
                  currentAmount: input.currentAmount,
                  targetDate: input.targetDate,
                  notes: input.notes?.trim(),
                }
              : item,
          ),
        },
        { area: 'goals', action: 'update', message: `更新目标：${input.title.trim()}` },
      ),
    )
  }

  function removeGoal(id: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          goals: current.goals.filter((item) => item.id !== id),
        },
        { area: 'goals', action: 'delete', message: '删除一条目标记录' },
      ),
    )
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const validation = validateHouseholdData(parsed)

      if (!validation.ok) {
        throw new Error(validation.message)
      }

      setData(
        withActivity(validation.data, {
          area: 'system',
          action: 'import',
          message: '导入家庭资产规划备份',
        }),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '请选择有效的家庭资产规划 JSON 文件。'
      window.alert(`导入失败：${message}`)
    }

    event.target.value = ''
  }

  function importValidatedData(nextData: HouseholdData) {
    setData(
      withActivity(nextData, {
        area: 'system',
        action: 'import',
        message: '导入家庭资产规划备份',
      }),
    )
  }

  function recordAlert(message: string) {
    setData((current) => {
      const oneDayMs = 24 * 60 * 60 * 1000
      const nowMs = Date.now()
      const duplicated = current.activityLog.some((entry) => {
        if (entry.action !== 'alert' || entry.message !== message) {
          return false
        }

        const diff = nowMs - new Date(entry.timestamp).getTime()
        return diff >= 0 && diff <= oneDayMs
      })

      if (duplicated) {
        return current
      }

      return withActivity(
        current,
        {
          area: 'system',
          action: 'alert',
          message,
        },
        { withSnapshot: false },
      )
    })
  }

  function exportData() {
    const exportPayload = {
      version: PLANNER_DATA_VERSION,
      data,
    }
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'family-asset-planner-data.json'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  function resetData() {
    setData(
      withActivity(resetHouseholdData(), {
        area: 'system',
        action: 'reset',
        message: '恢复默认样例数据',
      }),
    )
  }

  const value = useMemo(
    () => ({
      data,
      metrics,
      addAsset,
      updateAsset,
      removeAsset,
      addLiability,
      updateLiability,
      removeLiability,
      addIncome,
      updateIncome,
      removeIncome,
      addExpense,
      updateExpense,
      removeExpense,
      addGoal,
      updateGoal,
      removeGoal,
      importData,
      importValidatedData,
      recordAlert,
      exportData,
      resetData,
    }),
    [data, metrics],
  )

  return (
    <PlannerDataContext.Provider value={value}>
      {children}
    </PlannerDataContext.Provider>
  )
}

export function usePlannerData() {
  const context = useContext(PlannerDataContext)

  if (!context) {
    throw new Error('usePlannerData must be used within PlannerDataProvider')
  }

  return context
}
