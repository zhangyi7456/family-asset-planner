import type {
  ActivityAction,
  ActivityArea,
  AssetCategory,
  ExpenseCategory,
  GoalCategory,
  IncomeCategory,
  LiabilityCategory,
} from '../types/planner'

export const assetCategoryLabels: Record<AssetCategory, string> = {
  cash: '现金与存款',
  investment: '投资账户',
  housing: '房产与长期资产',
  insurance: '保险与保障类',
  other: '其他资产',
}

export const liabilityCategoryLabels: Record<LiabilityCategory, string> = {
  mortgage: '房贷按揭',
  consumer: '消费负债',
  auto: '车贷',
  other: '其他负债',
}

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  salary: '工资',
  bonus: '奖金',
  investment: '投资收益',
  other: '其他收入',
}

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  living: '生活支出',
  housing: '住房支出',
  education: '教育支出',
  insurance: '保险支出',
  medical: '医疗支出',
  other: '其他支出',
}

export const goalCategoryLabels: Record<GoalCategory, string> = {
  housing: '住房目标',
  education: '教育目标',
  retirement: '退休规划',
  emergency: '应急储备',
  other: '其他目标',
}

export const activityAreaLabels: Record<ActivityArea, string> = {
  assets: '资产台账',
  liabilities: '负债管理',
  cashflow: '收支记录',
  goals: '目标规划',
  system: '系统操作',
}

export const activityActionLabels: Record<ActivityAction, string> = {
  create: '新增',
  update: '更新',
  delete: '删除',
  import: '导入',
  reset: '重置',
  alert: '预警',
}
