import axios, { type AxiosError } from 'axios'
import { api, num, str } from '@/api/client'
import type { GoalType } from '@/types'

/**
 * Agent timeout: VITE_LLM_TIMEOUT_SECONDS or backend-ish default.
 * Default Axios is 15s — too short for local LLM / template fallback path.
 */
const AI_TIMEOUT_MS = (() => {
  const fromEnv = Number(import.meta.env.VITE_LLM_TIMEOUT_SECONDS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv * 1000)
  return 90_000
})()

export type AiReason = {
  text: string
  scope?: 'request' | 'offer' | string
  /** Diagnostics only — do not show in main UI copy */
  sourceId?: string
}

export type AiWhatToChange = {
  text: string
}

export type AiAgentPrefill = {
  productId?: string
  goalType?: GoalType | string
  amount?: number
  termMonths?: number
}

/** Normalized agent reply (backend sends snake_case). */
export type AiAgentResponse = {
  summary: string
  mainReasons: AiReason[]
  whatToChange: AiWhatToChange[]
  nextSteps: string[]
  disclaimer?: string
  scoreComplete: boolean
  responseId: string
  /** llm = model passed checks; template = штатный резерв без LLM */
  mode?: 'llm' | 'template' | string
  model?: string
  productIds?: string[]
  prefill?: AiAgentPrefill
  /** Diagnostics only — not for end-user copy */
  validationErrors?: unknown
}

function mapReason(raw: Record<string, unknown>): AiReason {
  return {
    text: str(raw.text),
    scope: raw.scope != null ? str(raw.scope) : undefined,
    sourceId:
      raw.source_id != null || raw.sourceId != null
        ? str(raw.source_id ?? raw.sourceId)
        : undefined,
  }
}

export function mapAiAgentResponse(raw: Record<string, unknown>): AiAgentResponse {
  const mainReasons = ((raw.main_reasons ?? raw.mainReasons ?? []) as Record<string, unknown>[]).map(
    mapReason,
  )
  const whatToChange = (
    (raw.what_to_change ?? raw.whatToChange ?? []) as Record<string, unknown>[]
  ).map((r) => ({ text: str(r.text) }))
  const nextStepsRaw = (raw.next_steps ?? raw.nextSteps ?? []) as unknown[]
  const nextSteps = nextStepsRaw.map((s) =>
    typeof s === 'string' ? s : str((s as Record<string, unknown>).text),
  )

  const prefillRaw = (raw.prefill ?? null) as Record<string, unknown> | null
  const prefill = prefillRaw
    ? {
        productId:
          prefillRaw.product_id != null || prefillRaw.productId != null
            ? str(prefillRaw.product_id ?? prefillRaw.productId)
            : undefined,
        goalType: (prefillRaw.goal_type ?? prefillRaw.goalType) as GoalType | string | undefined,
        amount: prefillRaw.amount != null ? num(prefillRaw.amount) : undefined,
        termMonths:
          prefillRaw.term_months != null || prefillRaw.termMonths != null
            ? num(prefillRaw.term_months ?? prefillRaw.termMonths)
            : undefined,
      }
    : undefined

  const productIds = ((raw.product_ids ?? raw.productIds ?? []) as unknown[]).map((id) => str(id))
  const validationErrors = raw.validation_errors ?? raw.validationErrors

  if (import.meta.env.DEV && validationErrors != null) {
    // eslint-disable-next-line no-console
    console.debug('[ai] validation_errors', validationErrors)
  }

  return {
    summary: str(raw.summary),
    mainReasons,
    whatToChange,
    nextSteps,
    disclaimer: raw.disclaimer != null ? str(raw.disclaimer) : undefined,
    scoreComplete: Boolean(raw.score_complete ?? raw.scoreComplete ?? true),
    responseId: str(raw.response_id ?? raw.responseId),
    mode: raw.mode != null ? str(raw.mode) : undefined,
    model: raw.model != null ? str(raw.model) : undefined,
    productIds: productIds.length ? productIds : undefined,
    prefill,
    validationErrors,
  }
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const ax = err as AxiosError
  // no response = network / DNS / CORS; ECONNABORTED = timeout
  if (!ax.response) return true
  if (ax.code === 'ECONNABORTED' || ax.code === 'ERR_NETWORK') return true
  return false
}

/** One network/timeout retry; never retry 4xx/5xx bodies. Auth via shared axios interceptor. */
async function withAiRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isRetryableNetworkError(err)) {
      return await fn()
    }
    throw err
  }
}

/** User-facing message for agent calls (401/403/404/network/timeout). */
export function formatAiError(err: unknown, fallback = 'Не удалось получить ответ агента'): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : fallback
  }
  const status = err.response?.status
  const data = err.response?.data as
    | { error?: { message?: string }; detail?: unknown; message?: string }
    | undefined
  const detail = data?.detail
  const fromBody =
    data?.error?.message ||
    data?.message ||
    (typeof detail === 'string' ? detail : undefined)

  if (status === 401) return 'Сессия истекла — войдите снова'
  if (status === 403) return 'Нет доступа к этой заявке или ответу агента'
  if (status === 404) return fromBody || 'Данные не найдены — возможно, скоринг ещё не готов'
  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      return 'Превышено время ожидания ответа агента. Попробуйте ещё раз.'
    }
    return 'Сеть недоступна — проверьте соединение и повторите'
  }
  return fromBody || fallback
}

async function postAi<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  return withAiRetry(async () => {
    const { data } = await api.post(path, body, { timeout: AI_TIMEOUT_MS })
    return data as T
  })
}

export async function fetchApplicationExplanation(
  applicationId: string,
  question?: string,
): Promise<AiAgentResponse> {
  const body = question?.trim() ? { question: question.trim() } : {}
  const data = await postAi<Record<string, unknown>>(
    `/applications/${applicationId}/ai/explanation`,
    body,
  )
  return mapAiAgentResponse(data)
}

export async function postApplicationAiChat(
  applicationId: string,
  question: string,
): Promise<AiAgentResponse> {
  const data = await postAi<Record<string, unknown>>(`/applications/${applicationId}/ai/chat`, {
    question,
  })
  return mapAiAgentResponse(data)
}

export async function postProductSelection(
  companyId: string,
  input: { question: string; amount?: number; termMonths?: number },
): Promise<AiAgentResponse> {
  const body: Record<string, unknown> = { question: input.question }
  if (input.amount != null) body.amount = input.amount
  if (input.termMonths != null) body.termMonths = input.termMonths
  const data = await postAi<Record<string, unknown>>(
    `/companies/${companyId}/ai/product-selection`,
    body,
  )
  return mapAiAgentResponse(data)
}

export async function postAiResponseFeedback(
  responseId: string,
  input: { helpful: boolean; comment?: string },
): Promise<{ saved: boolean }> {
  const data = await postAi<Record<string, unknown>>(`/ai/responses/${responseId}/feedback`, {
    helpful: input.helpful,
    comment: input.comment,
  })
  return { saved: Boolean(data.saved) }
}
