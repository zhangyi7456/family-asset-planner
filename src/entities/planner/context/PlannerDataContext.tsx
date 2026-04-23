import {
  useEffect,
  useState,
  type ChangeEvent,
  type PropsWithChildren,
} from 'react'
import {
  calculateDashboardMetrics,
  createFinancialSnapshot,
} from '../lib/financials'
import {
  clearHouseholdData,
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
  InvestmentPosition,
  Liability,
  TaskCompletionRecord,
  TaskCompletionSource,
} from '../types/planner'
import {
  type NewAssetInput,
  type NewExpenseInput,
  type NewGoalInput,
  type NewIncomeInput,
  type NewInvestmentPositionInput,
  type NewLiabilityInput,
  PlannerDataContext,
  type PlannerDataContextValue,
  type UpdateProfileInput,
} from './planner-data-context'
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

function upsertCompletedTask(
  completedTasks: TaskCompletionRecord[],
  task: string,
  source: TaskCompletionSource,
) {
  const nextRecord: TaskCompletionRecord = {
    id: createRecordId('task'),
    task,
    source,
    completedAt: new Date().toISOString(),
  }

  return [nextRecord, ...completedTasks.filter((item) => item.task !== task)].slice(0, 40)
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

  const metrics = calculateDashboardMetrics(data)

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

  function addInvestmentPosition(input: NewInvestmentPositionInput) {
    const position: InvestmentPosition = {
      id: createRecordId('position'),
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      assetType: input.assetType,
      costPrice: input.costPrice,
      quantity: input.quantity,
      latestPrice: input.latestPrice,
      targetWeight: input.targetWeight,
      accumulatedDividend: input.accumulatedDividend,
      totalFees: input.totalFees,
      notes: input.notes?.trim(),
    }

    setData((current) =>
      withActivity(
        {
          ...current,
          investmentPositions: [...current.investmentPositions, position],
        },
        {
          area: 'portfolio',
          action: 'create',
          message: `新增持仓：${position.code}`,
        },
      ),
    )
  }

  function addInvestmentPositionsBatch(inputs: NewInvestmentPositionInput[]) {
    const positions: InvestmentPosition[] = inputs.map((input) => ({
      id: createRecordId('position'),
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      assetType: input.assetType,
      costPrice: input.costPrice,
      quantity: input.quantity,
      latestPrice: input.latestPrice,
      targetWeight: input.targetWeight,
      accumulatedDividend: input.accumulatedDividend,
      totalFees: input.totalFees,
      notes: input.notes?.trim(),
    }))

    setData((current) =>
      withActivity(
        {
          ...current,
          investmentPositions: [...current.investmentPositions, ...positions],
        },
        {
          area: 'portfolio',
          action: 'import',
          message: `导入持仓：${positions.length} 条`,
        },
      ),
    )
  }

  function updateInvestmentPosition(id: string, input: NewInvestmentPositionInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          investmentPositions: current.investmentPositions.map((item) =>
            item.id === id
              ? {
                  ...item,
                  code: input.code.trim().toUpperCase(),
                  name: input.name.trim(),
                  assetType: input.assetType,
                  costPrice: input.costPrice,
                  quantity: input.quantity,
                  latestPrice: input.latestPrice,
                  targetWeight: input.targetWeight,
                  accumulatedDividend: input.accumulatedDividend,
                  totalFees: input.totalFees,
                  notes: input.notes?.trim(),
                }
              : item,
          ),
        },
        {
          area: 'portfolio',
          action: 'update',
          message: `更新持仓：${input.code.trim().toUpperCase()}`,
        },
      ),
    )
  }

  function removeInvestmentPosition(id: string) {
    setData((current) => {
      const target = current.investmentPositions.find((item) => item.id === id)

      return withActivity(
        {
          ...current,
          investmentPositions: current.investmentPositions.filter((item) => item.id !== id),
        },
        {
          area: 'portfolio',
          action: 'delete',
          message: `删除持仓：${target?.code ?? '未知标的'}`,
        },
      )
    })
  }

  function updateProfile(input: UpdateProfileInput) {
    setData((current) =>
      withActivity(
        {
          ...current,
          profile: {
            familyName: input.familyName.trim(),
            members: input.members,
            monthlyTargetSavings: input.monthlyTargetSavings,
            riskProfile: input.riskProfile.trim(),
          },
        },
        {
          area: 'system',
          action: 'update',
          message: `更新家庭配置：${input.familyName.trim()}`,
        },
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

  function markTaskComplete(task: string, source: TaskCompletionSource) {
    setData((current) =>
      withActivity(
        {
          ...current,
          completedTasks: upsertCompletedTask(current.completedTasks, task, source),
        },
        {
          area: 'system',
          action: 'update',
          message: `标记任务完成：${task}`,
        },
        { withSnapshot: false },
      ),
    )
  }

  function clearTaskCompletion(task: string) {
    setData((current) =>
      withActivity(
        {
          ...current,
          completedTasks: current.completedTasks.filter((item) => item.task !== task),
        },
        {
          area: 'system',
          action: 'update',
          message: `恢复任务待处理：${task}`,
        },
        { withSnapshot: false },
      ),
    )
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

  function clearData() {
    setData(
      withActivity(clearHouseholdData(), {
        area: 'system',
        action: 'reset',
        message: '清空所有本地数据，回到空白项目',
      }),
    )
  }

  const value: PlannerDataContextValue = {
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
    addInvestmentPosition,
    addInvestmentPositionsBatch,
    updateInvestmentPosition,
    removeInvestmentPosition,
    updateProfile,
    importData,
    importValidatedData,
    recordAlert,
    markTaskComplete,
    clearTaskCompletion,
    exportData,
    clearData,
    resetData,
  }

  return (
    <PlannerDataContext.Provider value={value}>
      {children}
    </PlannerDataContext.Provider>
  )
}
