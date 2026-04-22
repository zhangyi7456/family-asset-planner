import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { usePlannerData } from '../context/PlannerDataContext'
import { formatCurrency, formatDateTime, formatRelativeTime } from '../lib/format'
import { activityActionLabels, activityAreaLabels } from '../lib/labels'
import { PLANNER_DATA_VERSION } from '../lib/storage'
import { validateHouseholdData } from '../lib/validation'
import type { HouseholdData } from '../types/planner'

export function SettingsPage() {
  const { data, exportData, importValidatedData, resetData } = usePlannerData()
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

  const groupedActivities = useMemo(() => {
    const groups = new Map<string, typeof filteredActivities>()

    filteredActivities.forEach((entry) => {
      const current = groups.get(entry.area) ?? []
      current.push(entry)
      groups.set(entry.area, current)
    })

    return Array.from(groups.entries())
  }, [filteredActivities])

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

  return (
    <section className="settings-page">
      <section className="section-grid">
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>数据设置与部署边界</h2>
              <p className="caption">GitHub Pages 版本优先保证静态可运行和数据可备份。</p>
            </div>
          </div>

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
          <div className="section-heading">
            <div>
              <h2>数据操作</h2>
              <p className="caption">先把备份和恢复链路打通，后面再接云同步。</p>
            </div>
          </div>

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
              <strong>恢复示例数据</strong>
              <p>将当前本地数据重置回项目默认样例。</p>
              <button className="secondary-action" type="button" onClick={resetData}>
                重置数据
              </button>
            </article>
          </div>
        </aside>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>操作历史</h2>
            <p className="caption">支持按模块、动作和关键词筛选，便于回看最近维护了什么。</p>
          </div>
          <span className="muted">共 {filteredActivities.length} 条命中记录</span>
        </div>

        <div className="toolbar-controls">
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

        {groupedActivities.length === 0 ? (
          <p className="empty-state">当前筛选条件下没有匹配的操作记录。</p>
        ) : (
          <div className="activity-groups">
            {groupedActivities.map(([area, entries]) => (
              <section key={area} className="activity-group">
                <div className="activity-group-header">
                  <strong>{activityAreaLabels[area as keyof typeof activityAreaLabels]}</strong>
                  <span className="pill pill-quiet">{entries.length} 条</span>
                </div>

                <ul className="setting-list">
                  {entries.map((entry) => (
                    <li key={entry.id} className="activity-item">
                      <div>
                        <div className="activity-meta">
                          <span className="pill">
                            {activityActionLabels[entry.action]}
                          </span>
                          <span className="pill pill-quiet">
                            {activityAreaLabels[entry.area]}
                          </span>
                        </div>
                        <strong>{entry.message}</strong>
                        <p>{formatDateTime(entry.timestamp)}</p>
                      </div>
                      <span className="muted">{formatRelativeTime(entry.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <h2>财务快照历史</h2>
            <p className="caption">保存关键财务指标的时间切片，用于首页趋势图和未来的数据迁移。</p>
          </div>
        </div>

        <div className="snapshot-grid">
          {snapshotHistory.map((snapshot) => (
            <article key={snapshot.id} className="setting-card">
              <strong>{formatDateTime(snapshot.timestamp)}</strong>
              <p className="caption">净资产 {formatCurrency(snapshot.netWorth)}</p>
              <div className="snapshot-metrics">
                <span>总资产 {formatCurrency(snapshot.totalAssets)}</span>
                <span>总负债 {formatCurrency(snapshot.totalLiabilities)}</span>
                <span>月收入 {formatCurrency(snapshot.monthlyIncome)}</span>
                <span>月支出 {formatCurrency(snapshot.monthlyExpenses)}</span>
                <span>自由现金流 {formatCurrency(snapshot.monthlyFreeCashflow)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {importPreview && (
        <section className="content-panel">
          <div className="section-heading">
            <div>
              <h2>导入预览确认</h2>
              <p className="caption">
                已解析文件 {importFileName || '（未命名文件）'}，请确认后再覆盖当前本地数据。
              </p>
            </div>
          </div>

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
