import { api, num, str } from '@/api/client'
import type { GoalType } from '@/types'

/** LLM may take longer than the default 15s Axios timeout. */
const AI_TIMEOUT_MS = 90_000

export type AiReason = {
  text: string
  scope?: 'request' | 'offer' | string
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
  mode?: 'llm' | 'template' | string
  productIds?: string[]
  prefill?: AiAgentPrefill
  validationErrors?: unknown
}

function mapReason(raw: Record<string, unknown>): AiReason {
  return {
    text: str(raw.text),
    scope: raw.scope != null ? str(raw.scope) : undefined,
    sourceId: raw.source_id != null || raw.sourceId != null
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
  const nextSteps = nextStepsRaw.map((s) => (typeof s === 'string' ? s : str((s as Record<string, unknown>).text)))

  const prefillRaw = (raw.prefill ?? null) as Record<string, unknown> | null
  const prefill = prefillRaw
    ? {
        productId:
          prefillRaw.product_id != null || prefillRaw.productId != null
            ? str(prefillRaw.product_id ?? prefillRaw.productId)
            : undefined,
        goalType: (prefillRaw.goal_type ?? prefillRaw.goalType) as GoalType | string | undefined,
        amount:
          prefillRaw.amount != null
            ? num(prefillRaw.amount)
            : undefined,
        termMonths:
          prefillRaw.term_months != null || prefillRaw.termMonths != null
            ? num(prefillRaw.term_months ?? prefillRaw.termMonths)
            : undefined,
      }
    : undefined

  const productIds = ((raw.product_ids ?? raw.productIds ?? []) as unknown[]).map((id) => str(id))

  return {
    summary: str(raw.summary),
    mainReasons,
    whatToChange,
    nextSteps,
    disclaimer: raw.disclaimer != null ? str(raw.disclaimer) : undefined,
    scoreComplete: Boolean(
      raw.score_complete ?? raw.scoreComplete ?? true,
    ),
    responseId: str(raw.response_id ?? raw.responseId),
    mode: raw.mode != null ? str(raw.mode) : undefined,
    productIds: productIds.length ? productIds : undefined,
    prefill,
    validationErrors: raw.validation_errors ?? raw.validationErrors,
  }
}

export async function fetchApplicationExplanation(
  applicationId: string,
  question?: string,
): Promise<AiAgentResponse> {
  const body = question?.trim() ? { question: question.trim() } : {}
  const { data } = await api.post(`/applications/${applicationId}/ai/explanation`, body, {
    timeout: AI_TIMEOUT_MS,
  })
  return mapAiAgentResponse(data as Record<string, unknown>)
}

export async function postApplicationAiChat(
  applicationId: string,
  question: string,
): Promise<AiAgentResponse> {
  const { data } = await api.post(
    `/applications/${applicationId}/ai/chat`,
    { question },
    { timeout: AI_TIMEOUT_MS },
  )
  return mapAiAgentResponse(data as Record<string, unknown>)
}

export async function postProductSelection(
  companyId: string,
  input: { question: string; amount?: number; termMonths?: number },
): Promise<AiAgentResponse> {
  const body: Record<string, unknown> = { question: input.question }
  if (input.amount != null) body.amount = input.amount
  if (input.termMonths != null) body.termMonths = input.termMonths
  const { data } = await api.post(`/companies/${companyId}/ai/product-selection`, body, {
    timeout: AI_TIMEOUT_MS,
  })
  return mapAiAgentResponse(data as Record<string, unknown>)
}

export async function postAiResponseFeedback(
  responseId: string,
  input: { helpful: boolean; comment?: string },
): Promise<{ saved: boolean }> {
  const { data } = await api.post(`/ai/responses/${responseId}/feedback`, {
    helpful: input.helpful,
    comment: input.comment,
  })
  const raw = data as Record<string, unknown>
  return { saved: Boolean(raw.saved) }
}
