import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'

export type ScenarioHandoff = {
  amount: number
  termMonths: number
  rate?: number
  payment?: number
  source: 'calculator' | 'forecast' | 'roi'
}

const KEY = 'alfa_scenario_handoff'

export function saveScenarioHandoff(data: ScenarioHandoff) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
  const draft = loadSelectionDraft()
  saveSelectionDraft({
    ...draft,
    amount: data.amount,
    termMonths: data.termMonths,
  })
}

export function takeScenarioHandoff(): ScenarioHandoff | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)
    return JSON.parse(raw) as ScenarioHandoff
  } catch {
    return null
  }
}
