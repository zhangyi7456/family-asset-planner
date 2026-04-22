import { Suspense, lazy, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { EChartsOption } from 'echarts'
import { usePlannerData } from '../context/PlannerDataContext'
import {
  calculateBudgetAssessment,
  createRecommendedBudgetCaps,
  loadExpenseBudgetCaps,
  saveExpenseBudgetCaps,
  type ExpenseBudgetCaps,
} from '../lib/budget'
import { formatCurrency, formatPercent } from '../lib/format'
import { expenseCategoryLabels, incomeCategoryLabels } from '../lib/labels'
import type { ExpenseCategory, IncomeCategory } from '../types/planner'

type EntryType = 'income' | 'expense'
type SortBy = 'amount-desc' | 'amount-asc' | 'name'

interface CashflowEntry {
  id: string
  type: EntryType
  name: string
  category: IncomeCategory | ExpenseCategory
  monthlyAmount: number
}

function buildSeriesData(categories: string[], source: { name: string; value: number }[]) {
  const map = new Map(source.map((item) => [item.name, item.value]))
  return categories.map((name) => map.get(name) ?? 0)
}

const PlannerChart = lazy(() =>
  import('../components/charts/PlannerChart').then((module) => ({
    default: module.PlannerChart,
  })),
)

export function CashflowPage() {
  const {
    data,
    metrics,
    recordAlert,
    addIncome,
    updateIncome,
    removeIncome,
    addExpense,
    updateExpense,
    removeExpense,
  } = usePlannerData()

  const [entryType, setEntryType] = useState<EntryType>('income')
  const [name, setName] = useState('')
  const [incomeCategory, setIncomeCategory] = useState<IncomeCategory>('salary')
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('living')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | EntryType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('amount-desc')
  const [budgetCaps, setBudgetCaps] = useState<ExpenseBudgetCaps>(() =>
    loadExpenseBudgetCaps(metrics.monthlyIncome),
  )

  useEffect(() => {
    saveExpenseBudgetCaps(budgetCaps)
  }, [budgetCaps])

  const entries = useMemo<CashflowEntry[]>(
    () => [
      ...data.incomes.map((item) => ({
        id: item.id,
        type: 'income' as const,
        name: item.name,
        category: item.category,
        monthlyAmount: item.monthlyAmount,
      })),
      ...data.expenses.map((item) => ({
        id: item.id,
        type: 'expense' as const,
        name: item.name,
        category: item.category,
        monthlyAmount: item.monthlyAmount,
      })),
    ],
    [data.expenses, data.incomes],
  )

  const visibleEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = entries.filter((entry) => {
      const categoryLabel =
        entry.type === 'income'
          ? incomeCategoryLabels[entry.category as IncomeCategory]
          : expenseCategoryLabels[entry.category as ExpenseCategory]
      const matchesKeyword =
        keyword.length === 0 ||
        entry.name.toLowerCase().includes(keyword) ||
        categoryLabel.toLowerCase().includes(keyword)
      const matchesType = filterType === 'all' || entry.type === filterType

      return matchesKeyword && matchesType
    })

    return filtered.toSorted((left, right) => {
      if (sortBy === 'amount-asc') {
        return left.monthlyAmount - right.monthlyAmount
      }

      if (sortBy === 'name') {
        return left.name.localeCompare(right.name, 'zh-CN')
      }

      return right.monthlyAmount - left.monthlyAmount
    })
  }, [entries, filterType, search, sortBy])

  const savingsRate = metrics.monthlyIncome
    ? (Math.max(metrics.monthlyFreeCashflow, 0) / metrics.monthlyIncome) * 100
    : 0

  const incomeByCategory = useMemo(() => {
    const totals = new Map<IncomeCategory, number>()
    data.incomes.forEach((item) => {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.monthlyAmount)
    })
    return Array.from(totals.entries())
      .map(([category, value]) => ({
        name: incomeCategoryLabels[category],
        value,
      }))
      .sort((left, right) => right.value - left.value)
  }, [data.incomes])

  const expenseByCategory = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>()
    data.expenses.forEach((item) => {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.monthlyAmount)
    })
    return Array.from(totals.entries())
      .map(([category, value]) => ({
        name: expenseCategoryLabels[category],
        value,
      }))
      .sort((left, right) => right.value - left.value)
  }, [data.expenses])

  const budgetAssessment = useMemo(
    () => calculateBudgetAssessment(data.expenses, budgetCaps),
    [budgetCaps, data.expenses],
  )

  const topExpense = expenseByCategory[0]
  const freeCashflowGap = Math.abs(Math.min(metrics.monthlyFreeCashflow, 0))
  const structuralTip =
    metrics.monthlyFreeCashflow < 0
      ? `当前每月资金缺口约 ${formatCurrency(freeCashflowGap)}，建议先压缩 ${
          topExpense?.name ?? '主要支出'
        }。`
      : topExpense
        ? `${topExpense.name} 当前约 ${formatCurrency(topExpense.value)}，可优先优化该项。`
        : '暂无支出数据，建议先录入固定支出后再分析结构。'

  const budgetSignals = [
    metrics.monthlyFreeCashflow < 0
      ? {
          title: '月度预算已透支',
          detail: `当前每月超支约 ${formatCurrency(
            freeCashflowGap,
          )}，应先下调固定支出再新增长期投入。`,
          tone: 'danger' as const,
        }
      : {
          title: '现金流预算为正',
          detail: `当前每月可结余 ${formatCurrency(
            metrics.monthlyFreeCashflow,
          )}，可用于目标投入或降杠杆。`,
          tone: 'good' as const,
        },
    budgetAssessment.totalOverspend > 0
      ? {
          title: '分类预算已超额',
          detail: `按你设置的类别上限计算，本月总超额约 ${formatCurrency(
            budgetAssessment.totalOverspend,
          )}。`,
          tone: 'warn' as const,
        }
      : {
          title: '分类预算未超额',
          detail: '当前各类别支出未超过预算上限，可继续按现有节奏执行。',
          tone: 'good' as const,
        },
    budgetAssessment.highestPressureCategory &&
    budgetAssessment.highestPressureCategory.usageRate > 100
      ? {
          title: '单项支出压力最高',
          detail: `${budgetAssessment.highestPressureCategory.label} 已用到 ${formatPercent(
            budgetAssessment.highestPressureCategory.usageRate,
          )}，建议优先处理该项。`,
          tone: 'danger' as const,
        }
      : {
          title: '单项支出压力可控',
          detail: '目前没有类别明显越线，建议继续保持分类预算管理。',
          tone: 'good' as const,
        },
    budgetAssessment.totalCap > 0
      ? {
          title: '预算使用率',
          detail: `当前已使用 ${formatPercent(
            (budgetAssessment.totalActual / budgetAssessment.totalCap) * 100,
          )}。`,
          tone:
            budgetAssessment.totalActual / budgetAssessment.totalCap > 1
              ? ('warn' as const)
              : ('good' as const),
        }
      : {
          title: '请先设置预算上限',
          detail: '未设置有效预算上限时，系统无法给出分类预算预警。',
          tone: 'warn' as const,
        },
  ]

  const alertEvents = useMemo(
    () => [
      {
        active: metrics.monthlyFreeCashflow < 0,
        message: '预警：月度预算已透支，请优先修复现金流。',
      },
      {
        active: budgetAssessment.totalOverspend > 0,
        message: '预警：分类预算已超额，请检查预算上限与支出结构。',
      },
      {
        active: (budgetAssessment.highestPressureCategory?.usageRate ?? 0) > 110,
        message: `预警：${budgetAssessment.highestPressureCategory?.label ?? '某项支出'}压力过高，建议优先优化。`,
      },
    ],
    [budgetAssessment.highestPressureCategory, budgetAssessment.totalOverspend, metrics.monthlyFreeCashflow],
  )

  useEffect(() => {
    alertEvents.forEach((event) => {
      if (event.active) {
        recordAlert(event.message)
      }
    })
  }, [alertEvents, recordAlert])

  const chartCategories = useMemo(
    () => Array.from(new Set([...incomeByCategory, ...expenseByCategory].map((item) => item.name))),
    [incomeByCategory, expenseByCategory],
  )

  const categoryChartOption: EChartsOption = {
    color: ['#7fb69d', '#527b94'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(17, 24, 39, 0.92)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc' },
      valueFormatter: (value) => `${value} 元`,
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#5b6472' },
    },
    grid: {
      left: 12,
      right: 12,
      top: 20,
      bottom: 50,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartCategories,
      axisLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.14)' } },
      axisTick: { show: false },
      axisLabel: { color: '#5b6472' },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#5b6472',
        formatter: (value: number) => `${Math.round(value / 1000)}k`,
      },
      splitLine: { lineStyle: { color: 'rgba(17, 24, 39, 0.08)' } },
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        barGap: '20%',
        barWidth: '34%',
        data: buildSeriesData(chartCategories, incomeByCategory),
      },
      {
        name: '支出',
        type: 'bar',
        barWidth: '34%',
        data: buildSeriesData(chartCategories, expenseByCategory),
      },
    ],
  }

  function resetForm() {
    setName('')
    setMonthlyAmount('')
    setEditingId(null)
    setEntryType('income')
    setIncomeCategory('salary')
    setExpenseCategory('living')
  }

  function resetBudgetCaps() {
    setBudgetCaps(createRecommendedBudgetCaps(metrics.monthlyIncome))
  }

  function updateBudgetCap(category: ExpenseCategory, value: string) {
    const parsed = Number(value)
    setBudgetCaps((current) => ({
      ...current,
      [category]: Number.isFinite(parsed) ? Math.max(parsed, 0) : 0,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const numericAmount = Number(monthlyAmount)
    if (!name.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return
    }

    if (entryType === 'income') {
      const payload = {
        name,
        category: incomeCategory,
        monthlyAmount: numericAmount,
      }
      if (editingId) {
        updateIncome(editingId, payload)
      } else {
        addIncome(payload)
      }
    } else {
      const payload = {
        name,
        category: expenseCategory,
        monthlyAmount: numericAmount,
      }
      if (editingId) {
        updateExpense(editingId, payload)
      } else {
        addExpense(payload)
      }
    }

    resetForm()
  }

  function startEdit(entry: CashflowEntry) {
    setEditingId(entry.id)
    setEntryType(entry.type)
    setName(entry.name)
    setMonthlyAmount(String(entry.monthlyAmount))

    if (entry.type === 'income') {
      setIncomeCategory(entry.category as IncomeCategory)
    } else {
      setExpenseCategory(entry.category as ExpenseCategory)
    }
  }

  function handleRemove(entry: CashflowEntry) {
    if (entry.type === 'income') {
      removeIncome(entry.id)
      return
    }
    removeExpense(entry.id)
  }

  return (
    <section className="cashflow-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>{editingId ? '编辑收支记录' : '收支录入'}</h2>
              <p className="caption">统一维护月度收入与支出，首页现金流会实时联动更新。</p>
            </div>
          </div>

          <form className="data-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>记录类型</span>
              <select
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as EntryType)}
              >
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
            </label>

            <label className="field">
              <span>名称</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={entryType === 'income' ? '例如：主申请人工资' : '例如：家庭日常支出'}
              />
            </label>

            {entryType === 'income' ? (
              <label className="field">
                <span>收入类别</span>
                <select
                  value={incomeCategory}
                  onChange={(event) =>
                    setIncomeCategory(event.target.value as IncomeCategory)
                  }
                >
                  <option value="salary">工资</option>
                  <option value="bonus">奖金</option>
                  <option value="investment">投资收益</option>
                  <option value="other">其他收入</option>
                </select>
              </label>
            ) : (
              <label className="field">
                <span>支出类别</span>
                <select
                  value={expenseCategory}
                  onChange={(event) =>
                    setExpenseCategory(event.target.value as ExpenseCategory)
                  }
                >
                  <option value="living">生活支出</option>
                  <option value="housing">住房支出</option>
                  <option value="education">教育支出</option>
                  <option value="insurance">保险支出</option>
                  <option value="medical">医疗支出</option>
                  <option value="other">其他支出</option>
                </select>
              </label>
            )}

            <label className="field">
              <span>月度金额</span>
              <input
                inputMode="numeric"
                value={monthlyAmount}
                onChange={(event) => setMonthlyAmount(event.target.value)}
                placeholder="例如：12000"
              />
            </label>

            <div className="form-actions field-wide">
              <button className="primary-action" type="submit">
                {editingId ? '更新记录' : '保存记录'}
              </button>
              {editingId && (
                <button className="secondary-action" type="button" onClick={resetForm}>
                  取消编辑
                </button>
              )}
            </div>
          </form>
        </section>

        <aside className="content-panel">
          <div className="section-heading">
            <div>
              <h2>现金流摘要</h2>
              <p className="caption">基于当前收支记录，快速判断家庭结余能力。</p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <strong>月收入</strong>
              <p>当前所有收入项按月汇总。</p>
              <span className="summary-value">{formatCurrency(metrics.monthlyIncome)}</span>
            </article>
            <article className="summary-card">
              <strong>月支出</strong>
              <p>当前所有支出项按月汇总。</p>
              <span className="summary-value">{formatCurrency(metrics.monthlyExpenses)}</span>
            </article>
            <article className="summary-card">
              <strong>自由现金流</strong>
              <p>月收入减月支出后的可分配资金。</p>
              <span className="summary-value">
                {formatCurrency(metrics.monthlyFreeCashflow)}
              </span>
            </article>
            <article className="summary-card">
              <strong>储蓄率</strong>
              <p>自由现金流占月收入比例。</p>
              <span className="summary-value">{formatPercent(savingsRate)}</span>
            </article>
            <article className="summary-card">
              <strong>最大支出项</strong>
              <p>{topExpense ? topExpense.name : '暂无数据'}</p>
              <span className="summary-value">
                {topExpense ? formatCurrency(topExpense.value) : formatCurrency(0)}
              </span>
            </article>
            <article className="summary-card">
              <strong>结构建议</strong>
              <p>{structuralTip}</p>
              <span className="summary-value">
                {metrics.monthlyFreeCashflow < 0 ? '现金流告警' : '结构可优化'}
              </span>
            </article>
          </div>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>收支台账</h2>
            <p className="caption">支持按类型筛选与关键词搜索，便于快速定位具体记录。</p>
          </div>
        </div>

        <div className="toolbar-controls">
          <label className="field">
            <span>搜索</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="按名称或类别搜索"
            />
          </label>

          <label className="field">
            <span>类型筛选</span>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as 'all' | EntryType)}
            >
              <option value="all">全部</option>
              <option value="income">仅收入</option>
              <option value="expense">仅支出</option>
            </select>
          </label>

          <label className="field">
            <span>排序</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
            >
              <option value="amount-desc">金额从高到低</option>
              <option value="amount-asc">金额从低到高</option>
              <option value="name">名称排序</option>
            </select>
          </label>
        </div>

        <div className="asset-grid">
          {visibleEntries.map((entry) => (
            <article key={entry.id} className="asset-card">
              <strong>{entry.name}</strong>
              <p className="muted">
                类型：{entry.type === 'income' ? '收入' : '支出'} | 类别：
                {entry.type === 'income'
                  ? incomeCategoryLabels[entry.category as IncomeCategory]
                  : expenseCategoryLabels[entry.category as ExpenseCategory]}
              </p>
              <span className="summary-value">{formatCurrency(entry.monthlyAmount)}</span>
              <div className="card-actions">
                <button
                  className="inline-action"
                  type="button"
                  onClick={() => startEdit(entry)}
                >
                  编辑
                </button>
                <button
                  className="inline-action danger-action"
                  type="button"
                  onClick={() => handleRemove(entry)}
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
        {visibleEntries.length === 0 && (
          <p className="empty-state">当前筛选条件下没有收支记录。</p>
        )}
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>分类预算上限</h2>
            <p className="caption">可按支出类别设置月度上限，系统会按上限自动生成预警。</p>
          </div>
          <button className="secondary-action" type="button" onClick={resetBudgetCaps}>
            恢复推荐上限
          </button>
        </div>

        <div className="allocation-grid">
          {(Object.keys(budgetCaps) as ExpenseCategory[]).map((category) => {
            const row = budgetAssessment.categories.find((item) => item.category === category)
            const usageRate = row?.usageRate ?? 0
            const signalClass =
              usageRate > 110
                ? 'signal-card-danger'
                : usageRate > 90
                  ? 'signal-card-warn'
                  : 'signal-card-good'

            return (
              <article key={category} className={`setting-card ${signalClass}`}>
                <strong>{expenseCategoryLabels[category]}</strong>
                <label className="field">
                  <span>预算上限</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={budgetCaps[category]}
                    onChange={(event) => updateBudgetCap(category, event.target.value)}
                  />
                </label>
                <p className="muted">
                  当前支出 {formatCurrency(row?.actual ?? 0)}，使用率 {formatPercent(usageRate)}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>分类对比图</h2>
            <p className="caption">按类别对比收入与支出结构，帮助定位最可优化的支出项。</p>
          </div>
        </div>
        <Suspense fallback={<div className="chart-loading">正在加载图表…</div>}>
          <PlannerChart option={categoryChartOption} height={320} />
        </Suspense>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>预算阈值提醒</h2>
            <p className="caption">基于收支结构与分类上限自动生成预算预警。</p>
          </div>
        </div>

        <div className="insight-grid">
          {budgetSignals.map((signal) => (
            <article
              key={signal.title}
              className={`signal-card signal-card-${signal.tone}`}
            >
              <strong>{signal.title}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
