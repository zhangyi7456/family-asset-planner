export interface WorkspaceNavItem {
  to: string
  label: string
  section: string
  description: string
  group: string
}

export interface WorkspaceNavGroup {
  id: string
  label: string
  items: WorkspaceNavItem[]
}

export const workspaceNavGroups: WorkspaceNavGroup[] = [
  {
    id: 'dashboard',
    label: '仪表盘',
    items: [
      {
        to: '/',
        label: '概览',
        section: '仪表盘',
        description: '查看家庭资产总览、关键收益与任务优先级。',
        group: '仪表盘',
      },
      {
        to: '/assets',
        label: '资产',
        section: '仪表盘',
        description: '管理资产台账、结构分布与币种敞口。',
        group: '仪表盘',
      },
    ],
  },
  {
    id: 'analysis',
    label: '分析',
    items: [
      {
        to: '/cashflow',
        label: '实时分析',
        section: '仪表盘',
        description: '追踪收支、预算执行和净现金流变化。',
        group: '分析',
      },
      {
        to: '/liabilities',
        label: '负债管理',
        section: '仪表盘',
        description: '查看负债压力、杠杆水平与偿债节奏。',
        group: '分析',
      },
      {
        to: '/planning',
        label: '目标推进',
        section: '仪表盘',
        description: '对比目标缺口、投入节奏与完成进度。',
        group: '分析',
      },
      {
        to: '/portfolio',
        label: '资产配置',
        section: '仪表盘',
        description: '跟踪资产配置、持仓、再平衡与结构联动。',
        group: '分析',
      },
      {
        to: '/diagnosis',
        label: '诊断中心',
        section: '仪表盘',
        description: '汇总当前问题、任务优先级与整改入口。',
        group: '分析',
      },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      {
        to: '/settings',
        label: '数据与备份',
        section: '仪表盘',
        description: '管理家庭配置、备份、示例数据与操作记录。',
        group: '系统',
      },
    ],
  },
]

const flatNavItems = workspaceNavGroups.flatMap((group) => group.items)

export function findWorkspaceNavItem(pathname: string) {
  if (pathname === '/') {
    return flatNavItems[0]
  }

  return flatNavItems.find((item) => item.to === pathname) ?? flatNavItems[0]
}
