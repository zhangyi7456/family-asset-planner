import { defaultHouseholdData } from '../data/seed'
import type { HouseholdData, PersistedPlannerSnapshot } from '../types/planner'
import { validateHouseholdData } from './validation'

const STORAGE_KEY = 'family-asset-planner:data'
export const PLANNER_DATA_VERSION = 3

export function loadHouseholdData(): HouseholdData {
  if (typeof window === 'undefined') {
    return defaultHouseholdData
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaultHouseholdData
  }

  try {
    const parsed = JSON.parse(raw)
    const validation = validateHouseholdData(parsed)
    if (!validation.ok) {
      return defaultHouseholdData
    }

    return validation.data
  } catch {
    return defaultHouseholdData
  }
}

export function saveHouseholdData(data: HouseholdData) {
  if (typeof window === 'undefined') {
    return
  }

  const snapshot: PersistedPlannerSnapshot = {
    version: PLANNER_DATA_VERSION,
    data,
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function resetHouseholdData() {
  saveHouseholdData(defaultHouseholdData)
  return defaultHouseholdData
}
