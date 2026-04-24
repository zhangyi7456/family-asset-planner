import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TaskActionCard } from '../../../shared/ui/task/TaskActionCard'
import { FocusActionSection } from '../../../shared/ui/workspace/FocusActionSection'
import { PanelHeader } from '../../../shared/ui/workspace/PanelHeader'
import { usePlannerData } from '../../../entities/planner/context/usePlannerData'
import { formatCurrency, formatDateTime, formatPercent, formatRelativeTime } from '../../../entities/planner/lib/format'
import { activityActionLabels, activityAreaLabels } from '../../../entities/planner/lib/labels'
import { PLANNER_DATA_VERSION } from '../../../entities/planner/lib/storage'
import { validateHouseholdData } from '../../../entities/planner/lib/validation'
import type { HouseholdData } from '../../../entities/planner/types/planner'

interface SettingsProfileFormProps {
  profile: HouseholdData['profile']
  onSubmit: (input: {
    familyName: string
    members: number
    monthlyTargetSavings: number
    riskProfile: string
  }) => void
}

function SettingsProfileForm({ profile, onSubmit }: SettingsProfileFormProps) {
  const [familyName, setFamilyName] = useState(profile.familyName)
  const [members, setMembers] = useState(String(profile.members))
  const [monthlyTargetSavings, setMonthlyTargetSavings] = useState(
    String(profile.monthlyTargetSavings),
  )
  const [riskProfile, setRiskProfile] = useState(profile.riskProfile)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedMembers = Number(members)
    const parsedTargetSavings = Number(monthlyTargetSavings)
    if (
      !familyName.trim() ||
      !riskProfile.trim() ||
      !Number.isFinite(parsedMembers) ||
      !Number.isFinite(parsedTargetSavings) ||
      parsedMembers <= 0 ||
      parsedTargetSavings < 0
    ) {
      return
    }

    onSubmit({
      familyName,
      members: Math.max(1, Math.round(parsedMembers)),
      monthlyTargetSavings: parsedTargetSavings,
      riskProfile,
    })
  }

  return (
    <form className="data-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>家庭名称</span>
        <input
          value={familyName}
          onChange={(event) => setFamilyName(event.target.value)}
          placeholder="例如：张家家庭资产规划"
        />
      </label>

      <label className="field">
        <span>家庭成员数</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={members}
          onChange={(event) => setMembers(event.target.value)}
          placeholder="例如：3"
        />
      </label>

      <label className="field">
        <span>月度目标储蓄</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={monthlyTargetSavings}
          onChange={(event) => setMonthlyTargetSavings(event.target.value)}
          placeholder="例如：24000"
        />
      </label>

      <label className="field">
        <span>风险偏好</span>
        <select
          value={riskProfile}
          onChange={(event) => setRiskProfile(event.target.value)}
        >
          <option value="保守型">保守型</option>
          <option value="稳健型">稳健型</option>
          <option value="平衡型">平衡型</option>
          <option value="成长型">成长型</option>
          <option value="进取型">进取型</option>
        </select>
      </label>

      <div className="form-actions field-wide">
        <button className="primary-action" type="submit">
          保存基础配置
        </button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const {
    data,
    metrics,
    updateProfile,
    exportData,
    importValidatedData,
    clearData,
    resetData,
  } =
    usePlannerData()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [keyword, setKeyword] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [importPreview, setImportPreview] = useState<HouseholdData | null>(null)
  const [importFileName, setImportFileName] = useState('')

  const filteredActivities = useMemo(() => {
    const query = keyword.trim().toLowerCase()

    return data.activityLog.filter((entry) => {
      const matchesKeyword =
        query.length === 0 ||
        entry.message.toLowerCase().includes(query) ||
        activityAreaLabels[entry.area].toLowerCase().includes(query) ||
        activityActionLabels[entry.action].toLowerCase().includes(query)
      const matchesArea = areaFilter === 'all' || entry.area === areaFilter
      const matchesAction = actionFilter === 'all' || entry.action === actionFilter

      return matchesKeyword && matchesArea && matchesAction
    })
  }, [actionFilter, areaFilter, data.activityLog, keyword])

  const snapshotHistory = [...data.snapshotHistory].reverse()
  const currentLatestSnapshot = data.snapshotHistory[data.snapshotHistory.length - 1]
  const previewLatestSnapshot = importPreview
    ? importPreview.snapshotHistory[importPreview.snapshotHistory.length - 1]
    : null
  const diffSummary = importPreview
    ? {
        assets: importPreview.assets.length - data.assets.length,
        liabilities: importPreview.liabilities.length - data.liabilities.length,
        goals: importPreview.goals.length - data.goals.length,
        netWorth:
          (previewLatestSnapshot?.netWorth ?? 0) - (currentLatestSnapshot?.netWorth ?? 0),
      }
    : null

  const systemStats = [
    {
      label: '净资产',
      value: formatCurrency(metrics.netWorth),
      detail: '基础配置已联动资产与负债计算',
    },
    {
      label: '月净现金流',
      value: formatCurrency(metrics.monthlyFreeCashflow),
      detail: '基础配置已联动收支与预算计算',
    },
    {
      label: '数据版本',
      value: `v${PLANNER_DATA_VERSION}`,
      detail: `快照 ${data.snapshotHistory.length} 条`,
    },
    {
      label: '最后更新时间',
      value: formatRelativeTime(data.updatedAt),
      detail: formatDateTime(data.updatedAt),
    },
  ]
  const hasPreview = Boolean(importPreview)
  const settingsActions = [
    {
      title: hasPreview ? '先确认导入预览差异' : '先导出当前数据备份',
      detail: hasPreview
        ? `当前待导入文件为 ${importFileName || '未命名文件'}，建议先核对记录规模和净资产变化。`
        : '在继续调整配置或导入数据前，先导出一份 JSON 备份更稳妥。',
      badge: hasPreview ? '待确认导入' : '备份优先',
      tone: hasPreview ? 'warn' : 'good',
      actionKind: hasPreview ? 'preview' : 'export',
      label: hasPreview ? '查看预览' : '导出备份',
    },
    {
      title: data.snapshotHistory.length < 12 ? '建议补齐历史快照' : '快照历史已可支撑趋势分析',
      detail:
        data.snapshotHistory.length < 12
          ? `当前仅有 ${data.snapshotHistory.length} 条快照，长期趋势的参考性还不够。`
          : `当前已保存 ${data.snapshotHistory.length} 条快照，可支撑趋势分析和迁移兼容。`,
      badge: data.snapshotHistory.length < 12 ? '历史偏少' : '历史可用',
      tone: data.snapshotHistory.length < 12 ? 'warn' : 'good',
      actionKind: 'snapshots',
      label: '查看快照',
    },
    {
      title: filteredActivities.length > 0 ? '最近操作记录可审计' : '当前没有命中的操作记录',
      detail:
        filteredActivities.length > 0
          ? `当前筛选命中 ${filteredActivities.length} 条操作记录，可回看最近的维护动作。`
          : '当前筛选条件下没有匹配记录，可调整筛选后再查看。',
      badge: filteredActivities.length > 0 ? '审计可用' : '等待筛选',
      tone: filteredActivities.length > 0 ? 'good' : 'neutral',
      actionKind: 'history',
      label: '查看历史',
    },
  ] as const

  function closeImportPreview() {
    setImportPreview(null)
    setImportFileName('')
  }

  async function handleImportSelect(event: ChangeEvent<HTMLInputElement>) {
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

      setImportPreview(validation.data)
      setImportFileName(file.name)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '请选择有效的家庭资产规划 JSON 文件。'
      window.alert(`导入失败：${message}`)
    }

    event.target.value = ''
  }

  function confirmImport() {
    if (!importPreview) {
      return
    }
    importValidatedData(importPreview)
    closeImportPreview()
  }

  function focusPanel(selector: string) {
    if (typeof window === 'undefined') {
      return
    }

    const targetPanel = document.querySelector<HTMLElement>(selector)
    if (!targetPanel) {
      return
    }

    targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    targetPanel.classList.add('panel-focus-active')

    window.setTimeout(() => {
      targetPanel.classList.remove('panel-focus-active')
    }, 1400)
  }

  function runSettingsAction(actionKind: (typeof settingsActions)[number]['actionKind']) {
    if (actionKind === 'export') {
      exportData()
      return
    }

    const targetPanel =
      actionKind === 'preview'
        ? '.import-preview-card'
        : actionKind === 'snapshots'
          ? '[data-settings-panel="snapshots"]'
          : '[data-settings-panel="history"]'

    focusPanel(targetPanel)
  }

  return (
    <section className="settings-page ops-page">
      <section className="workspace-notice">
        <div>
          <strong>温馨提示</strong>
          <p>
            系统页负责基础配置、数据备份、导入预览和操作审计。这里不强调大卡片，而是像控制台一样优先保证可查、可改、可恢复。
          </p>
        </div>
      </section>

      <section className="workspace-stat-grid">
        {systemStats.map((item) => (
          <article key={item.label} className="workspace-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <FocusActionSection
        focusTitle="当前系统焦点"
        focusDescription="这一页先回答两件事：当前本地数据是否安全可恢复，以及配置调整是否已经稳定影响全站。"
        focusMeta={<span className="pill pill-quiet">数据版本 v{PLANNER_DATA_VERSION}</span>}
        focusContent={
          <div className="task-action-grid">
            <TaskActionCard
              icon="数"
              title={data.profile.familyName}
              detail="当前基础配置会实时影响总览、诊断、目标推进与组合建议，是全站计算入口。"
              badge={`${data.profile.members} 人家庭`}
              tone="good"
              meta={`目标储蓄 ${formatCurrency(data.profile.monthlyTargetSavings)} / 风险偏好 ${data.profile.riskProfile}`}
              action={
                <Link className="inline-action" to="/diagnosis">
                  查看诊断
                </Link>
              }
            />
            <TaskActionCard
              icon="备"
              title={hasPreview ? '存在待确认导入文件' : '当前本地数据可备份'}
              detail={
                hasPreview
                  ? `预览文件 ${importFileName || '未命名文件'} 尚未确认导入，建议先核对差异。`
                  : '当前项目运行在本地持久化模式，建议定期导出 JSON 备份。'
              }
              badge={hasPreview ? '待确认导入' : '建议先备份'}
              tone={hasPreview ? 'warn' : 'good'}
              meta={`快照 ${data.snapshotHistory.length} 条 / 活动 ${data.activityLog.length} 条`}
              action={
                <button
                  className="inline-action"
                  type="button"
                  onClick={() => runSettingsAction(hasPreview ? 'preview' : 'export')}
                >
                  {hasPreview ? '查看预览' : '导出备份'}
                </button>
              }
            />
          </div>
        }
        actionsDescription="优先打通备份、导入确认和配置校验，再继续做数据维护。"
        actionsContent={
          <div className="task-action-stack">
            {settingsActions.map((item) => (
              <TaskActionCard
                key={item.title}
                title={item.title}
                detail={item.detail}
                badge={item.badge}
                tone={item.tone}
                compact
                action={
                  <button
                    className="inline-action"
                    type="button"
                    onClick={() => runSettingsAction(item.actionKind)}
                  >
                    {item.label}
                  </button>
                }
              />
            ))}
          </div>
        }
      />

      <section className="section-grid">
        <section className="content-panel">
          <PanelHeader
            title="家庭基础配置"
            description="这里修改的参数会实时联动总览页、目标规划、预算分析与组合建议。"
          />

          <SettingsProfileForm
            key={`${data.profile.familyName}-${data.profile.members}-${data.profile.monthlyTargetSavings}-${data.profile.riskProfile}`}
            profile={data.profile}
            onSubmit={updateProfile}
          />
        </section>

        <aside className="content-panel ops-stack">
          <PanelHeader
            title="联动概览"
            description="用于确认当前配置已经影响全站计算结果。"
          />

          <div className="summary-grid ops-summary-grid">
            <article className="summary-card">
              <strong>家庭净资产</strong>
              <p>来自资产与负债页的联动结果。</p>
              <span className="summary-value">{formatCurrency(metrics.netWorth)}</span>
            </article>
            <article className="summary-card">
              <strong>月净现金流</strong>
              <p>来自收支页的联动结果。</p>
              <span className="summary-value">
                {formatCurrency(metrics.monthlyFreeCashflow)}
              </span>
            </article>
            <article className="summary-card">
              <strong>目标准备度</strong>
              <p>来自目标页的完成进度聚合。</p>
              <span className="summary-value">{formatPercent(metrics.goalReadiness)}</span>
            </article>
            <article className="summary-card">
              <strong>投资资产占比</strong>
              <p>来自资产分类与组合联动。</p>
              <span className="summary-value">
                {formatPercent(metrics.investmentAssetRatio)}
              </span>
            </article>
          </div>

          <article className="setting-card ops-list-card">
            <strong>配置说明</strong>
            <p className="caption">这里是全站计算的入口，修改后会影响总览、预算、目标和投资建议。</p>
            <ul className="setting-list">
              <li>
                <div>
                  <strong>月度目标储蓄</strong>
                  <p>用于校验家庭现金流是否足以支撑计划推进。</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>风险偏好</strong>
                  <p>会影响组合建议和后续资产配置语气。</p>
                </div>
              </li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="section-grid">
        <section className="content-panel">
          <PanelHeader
            title="数据设置与备份"
            description="GitHub Pages 版本优先保证静态可运行和数据可备份。"
          />

          <ul className="setting-list">
            <li>
              <div>
                <strong>本地持久化</strong>
                <p>当前数据保存在浏览器本地，无需后端即可运行。</p>
              </div>
            </li>
            <li>
              <div>
                <strong>最后更新时间</strong>
                <p>{formatDateTime(data.updatedAt)}</p>
              </div>
            </li>
            <li>
              <div>
                <strong>当前数据规模</strong>
                <p>
                  资产 {data.assets.length} 项，负债 {data.liabilities.length} 项，目标{' '}
                  {data.goals.length} 项。
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>数据版本</strong>
                <p>当前导入导出格式版本为 v{PLANNER_DATA_VERSION}。</p>
              </div>
            </li>
            <li>
              <div>
                <strong>历史快照数</strong>
                <p>当前保留 {data.snapshotHistory.length} 次财务快照，用于趋势分析与迁移兼容。</p>
              </div>
            </li>
          </ul>
        </section>

        <aside className="content-panel">
          <PanelHeader
            title="数据操作"
            description="先把备份和恢复链路打通，后面再接云同步。"
          />

          <div className="settings-grid">
            <article className="setting-card">
              <strong>导出 JSON</strong>
              <p>将当前家庭数据按带版本的 JSON 结构导出为本地备份文件。</p>
              <button className="secondary-action" type="button" onClick={exportData}>
                导出数据
              </button>
            </article>

            <article className="setting-card">
              <strong>导入 JSON</strong>
              <p>导入前会检查字段结构和记录类型，坏文件不会覆盖本地数据。</p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </button>
              <input
                ref={fileInputRef}
                className="hidden-input"
                type="file"
                accept="application/json"
                onChange={handleImportSelect}
              />
            </article>

            <article className="setting-card">
              <strong>导入示例数据</strong>
              <p>将当前本地数据替换为项目内置样例，便于快速查看完整效果。</p>
              <button className="secondary-action" type="button" onClick={resetData}>
                使用示例数据
              </button>
            </article>

            <article className="setting-card">
              <strong>清空为空白项目</strong>
              <p>删除当前本地记录，回到首次进入时的空白工作区。</p>
              <button className="secondary-action" type="button" onClick={clearData}>
                清空数据
              </button>
            </article>
          </div>
        </aside>
      </section>

      <section className="content-panel" data-settings-panel="history">
        <PanelHeader
          title="操作历史"
          description="支持按模块、动作和关键词筛选，便于回看最近维护了什么。"
          meta={<span className="muted">共 {filteredActivities.length} 条命中记录</span>}
        />

        <div className="workspace-filter-row">
          <label className="field">
            <span>搜索记录</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索新增、更新、目标或资产名称"
            />
          </label>

          <label className="field">
            <span>模块筛选</span>
            <select
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
            >
              <option value="all">全部模块</option>
              {Object.entries(activityAreaLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>动作筛选</span>
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              <option value="all">全部动作</option>
              {Object.entries(activityActionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredActivities.length === 0 ? (
          <p className="empty-state">当前筛选下暂无匹配的操作记录，可调整筛选条件后再查看。</p>
        ) : (
          <div className="workspace-table-shell">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>动作</th>
                  <th>内容</th>
                  <th>时间</th>
                  <th>相对时间</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((entry) => (
                  <tr key={entry.id}>
                    <td>{activityAreaLabels[entry.area]}</td>
                    <td>{activityActionLabels[entry.action]}</td>
                    <td>
                      <strong>{entry.message}</strong>
                    </td>
                    <td>{formatDateTime(entry.timestamp)}</td>
                    <td>{formatRelativeTime(entry.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-panel" data-settings-panel="snapshots">
        <PanelHeader
          title="财务快照历史"
          description="保存关键财务指标的时间切片，用于首页趋势图和未来的数据迁移。"
        />

        <div className="workspace-table-shell">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>净资产</th>
                <th>总资产</th>
                <th>总负债</th>
                <th>月收入</th>
                <th>月支出</th>
                <th>自由现金流</th>
              </tr>
            </thead>
            <tbody>
              {snapshotHistory.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{formatDateTime(snapshot.timestamp)}</td>
                  <td>{formatCurrency(snapshot.netWorth)}</td>
                  <td>{formatCurrency(snapshot.totalAssets)}</td>
                  <td>{formatCurrency(snapshot.totalLiabilities)}</td>
                  <td>{formatCurrency(snapshot.monthlyIncome)}</td>
                  <td>{formatCurrency(snapshot.monthlyExpenses)}</td>
                  <td>{formatCurrency(snapshot.monthlyFreeCashflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {importPreview && (
        <section className="content-panel import-preview-card">
          <PanelHeader
            title="导入预览确认"
            description={`已解析文件 ${importFileName || '（未命名文件）'}，请确认后再覆盖当前本地数据。`}
          />

          <div className="summary-grid">
            <article className="summary-card">
              <strong>家庭信息</strong>
              <p>
                {importPreview.profile.familyName}，成员 {importPreview.profile.members} 人
              </p>
              <span className="summary-value">{importPreview.profile.riskProfile}</span>
            </article>
            <article className="summary-card">
              <strong>记录规模</strong>
              <p>
                资产 {importPreview.assets.length}，负债 {importPreview.liabilities.length}，
                目标 {importPreview.goals.length}
              </p>
              <span className="summary-value">
                收支 {importPreview.incomes.length + importPreview.expenses.length} 项
              </span>
            </article>
            <article className="summary-card">
              <strong>导入后净资产</strong>
              <p>按导入文件内最后一次快照展示。</p>
              <span className="summary-value">
                {formatCurrency(
                  importPreview.snapshotHistory[importPreview.snapshotHistory.length - 1]
                    ?.netWorth ?? 0,
                )}
              </span>
            </article>
            <article className="summary-card">
              <strong>导入文件更新时间</strong>
              <p>用于判断是否是最新备份。</p>
              <span className="summary-value">{formatDateTime(importPreview.updatedAt)}</span>
            </article>
            <article className="summary-card">
              <strong>与当前数据差异</strong>
              <p>
                资产 {diffSummary?.assets ?? 0}，负债 {diffSummary?.liabilities ?? 0}，目标{' '}
                {diffSummary?.goals ?? 0}
              </p>
              <span className="summary-value">
                净资产 {formatCurrency(diffSummary?.netWorth ?? 0)}
              </span>
            </article>
          </div>

          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button className="primary-action" type="button" onClick={confirmImport}>
              确认导入并覆盖
            </button>
            <button className="secondary-action" type="button" onClick={closeImportPreview}>
              取消
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
