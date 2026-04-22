import type {
  ActivityLogEntry,
  ActivityAction,
  ActivityArea,
  FinancialSnapshot,
  HouseholdData,
} from '../types/planner'
import { createFinancialSnapshot } from './financials'

const assetCategories = new Set([
  'cash',
  'investment',
  'housing',
  'insurance',
  'other',
])

const liabilityCategories = new Set(['mortgage', 'consumer', 'auto', 'other'])
const incomeCategories = new Set(['salary', 'bonus', 'investment', 'other'])
const expenseCategories = new Set([
  'living',
  'housing',
  'education',
  'insurance',
  'medical',
  'other',
])
const goalCategories = new Set([
  'housing',
  'education',
  'retirement',
  'emergency',
  'other',
])

type ValidationResult =
  | { ok: true; data: HouseholdData }
  | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown) {
  return typeof value === 'string'
}

function isNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateProfile(input: unknown) {
  if (!isRecord(input)) {
    return '缺少家庭基础信息。'
  }

  if (
    !isString(input.familyName) ||
    !isNumber(input.members) ||
    !isNumber(input.monthlyTargetSavings) ||
    !isString(input.riskProfile)
  ) {
    return '家庭基础信息字段不完整或类型不正确。'
  }

  return null
}

function validateArrayField(
  input: unknown,
  fieldName: string,
  validator: (item: unknown, index: number) => string | null,
) {
  if (!Array.isArray(input)) {
    return `${fieldName} 应为数组。`
  }

  for (const [index, item] of input.entries()) {
    const error = validator(item, index)
    if (error) {
      return error
    }
  }

  return null
}

function validateAsset(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条资产记录格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.name) ||
    !assetCategories.has(String(item.category)) ||
    !isNumber(item.amount)
  ) {
    return `第 ${index + 1} 条资产记录字段不合法。`
  }

  return null
}

function validateLiability(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条负债记录格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.name) ||
    !liabilityCategories.has(String(item.category)) ||
    !isNumber(item.amount)
  ) {
    return `第 ${index + 1} 条负债记录字段不合法。`
  }

  return null
}

function validateIncome(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条收入记录格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.name) ||
    !incomeCategories.has(String(item.category)) ||
    !isNumber(item.monthlyAmount)
  ) {
    return `第 ${index + 1} 条收入记录字段不合法。`
  }

  return null
}

function validateExpense(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条支出记录格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.name) ||
    !expenseCategories.has(String(item.category)) ||
    !isNumber(item.monthlyAmount)
  ) {
    return `第 ${index + 1} 条支出记录字段不合法。`
  }

  return null
}

function validateGoal(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条目标记录格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.title) ||
    !goalCategories.has(String(item.category)) ||
    !isNumber(item.targetAmount) ||
    !isNumber(item.currentAmount) ||
    !isString(item.targetDate)
  ) {
    return `第 ${index + 1} 条目标记录字段不合法。`
  }

  return null
}

function validateActivity(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条活动记录格式错误。`
  }

  if (!isString(item.id) || !isString(item.timestamp) || !isString(item.message)) {
    return `第 ${index + 1} 条活动记录字段不合法。`
  }

  return null
}

function validateSnapshot(item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 条财务快照格式错误。`
  }

  if (
    !isString(item.id) ||
    !isString(item.timestamp) ||
    !isNumber(item.totalAssets) ||
    !isNumber(item.totalLiabilities) ||
    !isNumber(item.netWorth) ||
    !isNumber(item.monthlyIncome) ||
    !isNumber(item.monthlyExpenses) ||
    !isNumber(item.monthlyFreeCashflow)
  ) {
    return `第 ${index + 1} 条财务快照字段不合法。`
  }

  return null
}

function inferActivityArea(message: string): ActivityArea {
  if (message.includes('资产')) {
    return 'assets'
  }

  if (message.includes('负债')) {
    return 'liabilities'
  }

  if (message.includes('收入') || message.includes('支出') || message.includes('现金流')) {
    return 'cashflow'
  }

  if (message.includes('目标')) {
    return 'goals'
  }

  return 'system'
}

function inferActivityAction(message: string): ActivityAction {
  if (message.startsWith('新增')) {
    return 'create'
  }

  if (message.startsWith('更新')) {
    return 'update'
  }

  if (message.startsWith('删除')) {
    return 'delete'
  }

  if (message.startsWith('导入')) {
    return 'import'
  }

  if (message.startsWith('恢复')) {
    return 'reset'
  }

  if (message.startsWith('预警')) {
    return 'alert'
  }

  return 'create'
}

function normalizeActivityLog(input: unknown): ActivityLogEntry[] {
  const entries = Array.isArray(input) ? input : []

  return entries.map((item, index) => {
    const record = item as Record<string, unknown>
    const message = String(record.message)

    return {
      id: String(record.id ?? `activity-${index}`),
      timestamp: String(record.timestamp),
      message,
      area: (record.area as ActivityArea | undefined) ?? inferActivityArea(message),
      action: (record.action as ActivityAction | undefined) ?? inferActivityAction(message),
    }
  })
}

function normalizeInput(input: unknown): {
  version: number
  data: Record<string, unknown>
} | null {
  if (!isRecord(input)) {
    return null
  }

  if (isRecord(input.data) && isNumber(input.version)) {
    return {
      version: Number(input.version),
      data: input.data,
    }
  }

  return {
    version: 1,
    data: input,
  }
}

export function validateHouseholdData(input: unknown): ValidationResult {
  const normalized = normalizeInput(input)
  if (!normalized) {
    return { ok: false, message: '导入文件不是有效的 JSON 对象。' }
  }

  const data = normalized.data

  const profileError = validateProfile(data.profile)
  if (profileError) {
    return { ok: false, message: profileError }
  }

  const assetsError = validateArrayField(data.assets, '资产记录', validateAsset)
  if (assetsError) {
    return { ok: false, message: assetsError }
  }

  const liabilitiesError = validateArrayField(
    data.liabilities,
    '负债记录',
    validateLiability,
  )
  if (liabilitiesError) {
    return { ok: false, message: liabilitiesError }
  }

  const incomesError = validateArrayField(data.incomes, '收入记录', validateIncome)
  if (incomesError) {
    return { ok: false, message: incomesError }
  }

  const expensesError = validateArrayField(data.expenses, '支出记录', validateExpense)
  if (expensesError) {
    return { ok: false, message: expensesError }
  }

  const goalsError = validateArrayField(data.goals, '目标记录', validateGoal)
  if (goalsError) {
    return { ok: false, message: goalsError }
  }

  if (!isString(data.updatedAt)) {
    return { ok: false, message: '缺少更新时间字段。' }
  }

  const activityLogInput = Array.isArray(data.activityLog) ? data.activityLog : []
  const activityError = validateArrayField(
    activityLogInput,
    '活动记录',
    validateActivity,
  )
  if (activityError) {
    return { ok: false, message: activityError }
  }

  const snapshotHistoryInput = Array.isArray(data.snapshotHistory)
    ? data.snapshotHistory
    : []
  const snapshotError = validateArrayField(
    snapshotHistoryInput,
    '财务快照',
    validateSnapshot,
  )
  if (snapshotError) {
    return { ok: false, message: snapshotError }
  }

  const baseData = {
    profile: data.profile as HouseholdData['profile'],
    assets: data.assets as HouseholdData['assets'],
    liabilities: data.liabilities as HouseholdData['liabilities'],
    incomes: data.incomes as HouseholdData['incomes'],
    expenses: data.expenses as HouseholdData['expenses'],
    goals: data.goals as HouseholdData['goals'],
  }

  const normalizedActivityLog = normalizeActivityLog(activityLogInput)
  const normalizedSnapshotHistory =
    snapshotHistoryInput.length > 0
      ? (snapshotHistoryInput as FinancialSnapshot[])
      : [
          createFinancialSnapshot(
            {
              ...baseData,
              activityLog: [],
              snapshotHistory: [],
              updatedAt: data.updatedAt,
            },
            data.updatedAt,
          ),
        ]

  const migratedData: HouseholdData = {
    ...baseData,
    activityLog: normalizedActivityLog,
    snapshotHistory: normalizedSnapshotHistory,
    updatedAt: data.updatedAt,
  }

  return {
    ok: true,
    data: migratedData,
  }
}
