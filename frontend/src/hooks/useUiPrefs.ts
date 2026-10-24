import { useCallback, useSyncExternalStore } from 'react'

const COMPARE_KEY = 'alfa_compare_ids'
const PRODUCT_KEY = 'alfa_selected_product'

type Prefs = { compareIds: string[]; selectedProductId: string | null }

let prefs: Prefs = load()
const listeners = new Set<() => void>()

function load(): Prefs {
  try {
    const compareIds = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? '[]') as string[]
    const selectedProductId = localStorage.getItem(PRODUCT_KEY)
    return {
      compareIds: Array.isArray(compareIds) ? compareIds.slice(0, 3) : [],
      selectedProductId,
    }
  } catch {
    return { compareIds: [], selectedProductId: null }
  }
}

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return prefs
}

export function setCompareIds(ids: string[]) {
  prefs = { ...prefs, compareIds: ids.slice(0, 3) }
  localStorage.setItem(COMPARE_KEY, JSON.stringify(prefs.compareIds))
  notify()
}

export function setSelectedProduct(id: string | null) {
  prefs = { ...prefs, selectedProductId: id }
  if (id) localStorage.setItem(PRODUCT_KEY, id)
  else localStorage.removeItem(PRODUCT_KEY)
  notify()
}

export function useUiPrefs() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    compareIds: snap.compareIds,
    selectedProductId: snap.selectedProductId,
    setCompareIds: useCallback(setCompareIds, []),
    setSelectedProduct: useCallback(setSelectedProduct, []),
  }
}
