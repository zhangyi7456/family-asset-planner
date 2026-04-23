import { useContext } from 'react'
import { PlannerDataContext } from './planner-data-context'

export function usePlannerData() {
  const context = useContext(PlannerDataContext)

  if (!context) {
    throw new Error('usePlannerData must be used within PlannerDataProvider')
  }

  return context
}
