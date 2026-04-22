import type {
  ActivityLogEntry,
  Asset,
  ExpenseRecord,
  FinancialSnapshot,
  GoalPlan,
  HouseholdData,
  IncomeRecord,
  Liability,
} from '../types/planner'

export const milestones = [
  {
    step: 'M1',
    title: '完成项目骨架与部署路径',
    description: '搭好 Vite、React、HashRouter、GitHub Pages 发布流程。',
  },
  {
    step: 'M2',
    title: '建立资产、负债、现金流录入模块',
    description: '引入统一数据模型和本地存储，让家庭数据真正可录入。',
  },
  {
    step: 'M3',
    title: '补齐规划能力和图表分析',
    description: '增加净资产趋势、目标进度和情景模拟。',
  },
]

export const defaultAssets: Asset[] = [
  {
    id: 'asset-cash',
    name: '家庭现金储备',
    category: 'cash',
    amount: 286000,
    notes: '活期存款、零钱账户和货币基金',
  },
  {
    id: 'asset-investment',
    name: '指数基金与股票账户',
    category: 'investment',
    amount: 845000,
    notes: '中长期投资组合',
  },
  {
    id: 'asset-property',
    name: '自住房净值',
    category: 'housing',
    amount: 1440000,
    notes: '按当前估值减按揭未偿部分后的净值',
  },
  {
    id: 'asset-insurance',
    name: '保险现金价值',
    category: 'insurance',
    amount: 327000,
    notes: '年金险与保障型保单现金价值',
  },
]

export const defaultLiabilities: Liability[] = [
  {
    id: 'liability-mortgage',
    name: '住房按揭',
    category: 'mortgage',
    amount: 920000,
    notes: '剩余按揭本金',
  },
  {
    id: 'liability-card',
    name: '信用卡待还',
    category: 'consumer',
    amount: 18000,
    notes: '当月待还账单',
  },
]

export const defaultIncomes: IncomeRecord[] = [
  {
    id: 'income-salary-a',
    name: '主申请人工资',
    category: 'salary',
    monthlyAmount: 42000,
  },
  {
    id: 'income-salary-b',
    name: '配偶工资',
    category: 'salary',
    monthlyAmount: 28000,
  },
  {
    id: 'income-investment',
    name: '投资收益',
    category: 'investment',
    monthlyAmount: 3600,
  },
]

export const defaultExpenses: ExpenseRecord[] = [
  {
    id: 'expense-living',
    name: '家庭日常支出',
    category: 'living',
    monthlyAmount: 18500,
  },
  {
    id: 'expense-housing',
    name: '房贷月供',
    category: 'housing',
    monthlyAmount: 14200,
  },
  {
    id: 'expense-education',
    name: '教育与成长',
    category: 'education',
    monthlyAmount: 6400,
  },
  {
    id: 'expense-insurance',
    name: '保险保费',
    category: 'insurance',
    monthlyAmount: 3900,
  },
]

export const defaultGoals: GoalPlan[] = [
  {
    id: 'goal-home-upgrade',
    title: '购房升级计划',
    category: 'housing',
    targetAmount: 1200000,
    currentAmount: 816000,
    targetDate: '2027-10-01',
    notes: '18 个月后启动改善型住房置换',
  },
  {
    id: 'goal-education',
    title: '子女教育金',
    category: 'education',
    targetAmount: 800000,
    currentAmount: 464000,
    targetDate: '2034-09-01',
    notes: '长期定投账户与低风险储备组合',
  },
  {
    id: 'goal-retirement',
    title: '退休现金流',
    category: 'retirement',
    targetAmount: 3000000,
    currentAmount: 1230000,
    targetDate: '2045-06-01',
    notes: '55 岁前建立半退休现金流安全垫',
  },
]

export const defaultActivityLog: ActivityLogEntry[] = [
  {
    id: 'activity-seed-01',
    timestamp: '2025-11-15T09:00:00.000Z',
    message: '初始化家庭资产规划样例数据',
    area: 'system',
    action: 'create',
  },
  {
    id: 'activity-seed-02',
    timestamp: '2026-01-08T09:00:00.000Z',
    message: '更新资产：指数基金与股票账户',
    area: 'assets',
    action: 'update',
  },
  {
    id: 'activity-seed-03',
    timestamp: '2026-02-12T09:00:00.000Z',
    message: '更新目标：购房升级计划',
    area: 'goals',
    action: 'update',
  },
  {
    id: 'activity-seed-04',
    timestamp: '2026-03-18T09:00:00.000Z',
    message: '更新支出：房贷月供',
    area: 'cashflow',
    action: 'update',
  },
  {
    id: 'activity-seed-05',
    timestamp: '2026-04-22T21:00:00.000Z',
    message: '更新收入：投资收益',
    area: 'cashflow',
    action: 'update',
  },
]

export const defaultSnapshotHistory: FinancialSnapshot[] = [
  {
    id: 'snapshot-20251115',
    timestamp: '2025-11-15T09:00:00.000Z',
    totalAssets: 2560000,
    totalLiabilities: 1012000,
    netWorth: 1548000,
    monthlyIncome: 70500,
    monthlyExpenses: 43800,
    monthlyFreeCashflow: 26700,
  },
  {
    id: 'snapshot-20251215',
    timestamp: '2025-12-15T09:00:00.000Z',
    totalAssets: 2624000,
    totalLiabilities: 998000,
    netWorth: 1626000,
    monthlyIncome: 71200,
    monthlyExpenses: 43500,
    monthlyFreeCashflow: 27700,
  },
  {
    id: 'snapshot-20260115',
    timestamp: '2026-01-15T09:00:00.000Z',
    totalAssets: 2718000,
    totalLiabilities: 982000,
    netWorth: 1736000,
    monthlyIncome: 72000,
    monthlyExpenses: 43300,
    monthlyFreeCashflow: 28700,
  },
  {
    id: 'snapshot-20260215',
    timestamp: '2026-02-15T09:00:00.000Z',
    totalAssets: 2794000,
    totalLiabilities: 966000,
    netWorth: 1828000,
    monthlyIncome: 72800,
    monthlyExpenses: 43200,
    monthlyFreeCashflow: 29600,
  },
  {
    id: 'snapshot-20260315',
    timestamp: '2026-03-15T09:00:00.000Z',
    totalAssets: 2846000,
    totalLiabilities: 951000,
    netWorth: 1895000,
    monthlyIncome: 73200,
    monthlyExpenses: 43150,
    monthlyFreeCashflow: 30050,
  },
  {
    id: 'snapshot-20260422',
    timestamp: '2026-04-22T21:00:00.000Z',
    totalAssets: 2898000,
    totalLiabilities: 938000,
    netWorth: 1960000,
    monthlyIncome: 73600,
    monthlyExpenses: 43000,
    monthlyFreeCashflow: 30600,
  },
]

export const defaultHouseholdData: HouseholdData = {
  profile: {
    familyName: '张家',
    members: 3,
    monthlyTargetSavings: 24000,
    riskProfile: '稳健增长',
  },
  assets: defaultAssets,
  liabilities: defaultLiabilities,
  incomes: defaultIncomes,
  expenses: defaultExpenses,
  goals: defaultGoals,
  activityLog: defaultActivityLog,
  snapshotHistory: defaultSnapshotHistory,
  updatedAt: '2026-04-22T21:00:00.000Z',
}
