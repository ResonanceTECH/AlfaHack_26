import type {
  CreditScenarioParams,
  CreditScenarioResult,
  PaymentRow,
  PaymentScheduleResult,
  ProjectEvaluationInput,
  ProjectEvaluationResult,
  ScheduleType,
} from '@/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Annuity monthly payment */
export function annuityPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / termMonths
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

export function buildPaymentSchedule(params: {
  amount: number
  termMonths: number
  annualRate: number
  scheduleType: ScheduleType
  startDate: string
  feesPercent?: number
  feesFixed?: number
}): PaymentScheduleResult {
  const { amount, termMonths, annualRate, scheduleType, startDate } = params
  const feesPercent = params.feesPercent ?? 0
  const feesFixed = params.feesFixed ?? 0
  const r = annualRate / 100 / 12
  const rows: PaymentRow[] = []
  let balance = amount
  let totalPayment = 0
  let totalInterest = 0
  let totalFees = 0

  const upfrontFee = round2((amount * feesPercent) / 100 + feesFixed)
  const monthlyAnnuity = annuityPayment(amount, annualRate, termMonths)
  const principalPart = amount / termMonths

  for (let m = 1; m <= termMonths; m++) {
    const interest = round2(balance * r)
    let principal: number
    let payment: number
    const fee = m === 1 ? upfrontFee : 0

    if (scheduleType === 'annuity') {
      payment = round2(monthlyAnnuity)
      principal = round2(Math.min(payment - interest, balance))
      payment = round2(principal + interest)
    } else {
      principal = round2(m === termMonths ? balance : principalPart)
      payment = round2(principal + interest)
    }

    balance = round2(Math.max(0, balance - principal))
    totalPayment += payment + fee
    totalInterest += interest
    totalFees += fee

    rows.push({
      month: m,
      date: addMonths(startDate, m - 1),
      payment: round2(payment + fee),
      principal,
      interest,
      fees: fee,
      balance,
    })
  }

  return {
    scheduleType,
    amount,
    termMonths,
    annualRate,
    monthlyPayment: scheduleType === 'annuity' ? round2(monthlyAnnuity) : round2(rows[0]?.payment ?? 0),
    totalPayment: round2(totalPayment),
    totalInterest: round2(totalInterest),
    totalFees: round2(totalFees),
    rows,
  }
}

export function calcRequiredAmount(input: {
  costs: Record<string, number>
  reserve: number
  ownFunds: number
  otherFunding: number
}): number {
  const costsSum = Object.values(input.costs).reduce((a, b) => a + b, 0)
  return Math.max(0, round2(costsSum + input.reserve - input.ownFunds - input.otherFunding))
}

export function runCreditScenario(
  name: string,
  params: CreditScenarioParams,
  id = crypto.randomUUID(),
): CreditScenarioResult {
  const schedule = buildPaymentSchedule({
    amount: params.amount,
    termMonths: params.termMonths,
    annualRate: params.annualRate,
    scheduleType: params.scheduleType,
    startDate: params.repaymentStartDate,
  })

  const monthlyPayment = schedule.monthlyPayment
  const series: CreditScenarioResult['series'] = []
  let balance = params.baseMonthlyRevenue * 0.4 - params.oneTimeInvestment + params.ownFunds
  const deficitMonths: number[] = []

  for (let m = 1; m <= params.termMonths; m++) {
    const season = 1 + (params.seasonalSwingPct / 100) * Math.sin((m / 12) * Math.PI * 2)
    const revenue =
      params.baseMonthlyRevenue * (1 + params.revenueChangePct / 100) * season
    const expenses = params.baseMonthlyExpenses * (1 + params.expenseChangePct / 100)
    const payment = schedule.rows[m - 1]?.payment ?? monthlyPayment
    const netFlow = revenue - expenses - payment
    balance = round2(balance + netFlow)
    if (balance < 0) deficitMonths.push(m)
    series.push({ month: m, balance, payment, netFlow: round2(netFlow) })
  }

  const minBalance = Math.min(...series.map((s) => s.balance))
  const cashFlowAfterPayment = round2(
    params.baseMonthlyRevenue * (1 + params.revenueChangePct / 100) -
      params.baseMonthlyExpenses * (1 + params.expenseChangePct / 100) -
      monthlyPayment,
  )

  const explanation =
    cashFlowAfterPayment >= 0
      ? 'При выбранных параметрах расчётный месячный денежный поток положительный.'
      : 'При выбранных параметрах после платежа остаётся отрицательный денежный поток — рассмотрите уменьшение суммы или удлинение срока.'

  return {
    id,
    name,
    params,
    monthlyPayment: round2(monthlyPayment),
    cashFlowAfterPayment,
    minBalance: round2(minBalance),
    deficitMonths,
    explanation,
    series,
    createdAt: new Date().toISOString(),
  }
}

function npv(rateMonthly: number, cashFlows: number[]): number {
  return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rateMonthly, t), 0)
}

function irr(cashFlows: number[]): number | null {
  let lo = -0.99
  let hi = 5
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const v = npv(mid, cashFlows)
    if (v > 0) lo = mid
    else hi = mid
  }
  const annual = ((1 + (lo + hi) / 2) ** 12 - 1) * 100
  if (!Number.isFinite(annual)) return null
  return round2(annual)
}

export function evaluateProject(input: ProjectEvaluationInput): ProjectEvaluationResult {
  const monthlyDebt = annuityPayment(input.creditAmount, input.creditRate, input.creditTermMonths)
  const discountMonthly = input.discountRate / 100 / 12
  const cashFlowsRaw: number[] = []
  const table: ProjectEvaluationResult['cashFlows'] = []

  const initialOut = -(input.initialInvestment)
  cashFlowsRaw.push(initialOut)
  table.push({ month: 0, cf: initialOut, cumulative: initialOut, discounted: initialOut })

  let cumulative = initialOut
  let discountedCum = initialOut
  let simplePayback: number | null = null
  let discountedPayback: number | null = null

  for (let m = 1; m <= input.horizonMonths; m++) {
    const sales = input.additionalSales
    const varCost = input.variableCosts
    const fixed = input.fixedCosts
    const ebit = sales - varCost - fixed
    const tax = Math.max(0, ebit) * (input.taxRate / 100)
    const debt = m <= input.creditTermMonths ? monthlyDebt : 0
    const residual = m === input.horizonMonths ? input.residualValue : 0
    const cf = round2(ebit - tax - debt + residual)
    cashFlowsRaw.push(cf)
    cumulative = round2(cumulative + cf)
    const discounted = round2(cf / Math.pow(1 + discountMonthly, m))
    discountedCum = round2(discountedCum + discounted)
    if (simplePayback === null && cumulative >= 0) simplePayback = m
    if (discountedPayback === null && discountedCum >= 0) discountedPayback = m
    table.push({ month: m, cf, cumulative, discounted: discountedCum })
  }

  const totalIn = table.slice(1).reduce((a, r) => a + Math.max(0, r.cf), 0)
  const roi = input.initialInvestment > 0 ? round2(((totalIn + input.residualValue) / input.initialInvestment - 1) * 100) : 0
  const contribution = input.additionalSales - input.variableCosts
  const breakEvenUnits =
    contribution > 0 && input.additionalSales > 0
      ? round2((input.fixedCosts + monthlyDebt) / (contribution / Math.max(1, input.additionalSales / 100)))
      : null

  return {
    simplePaybackMonths: simplePayback,
    discountedPaybackMonths: discountedPayback,
    npv: round2(npv(discountMonthly, cashFlowsRaw)),
    irr: irr(cashFlowsRaw),
    roi,
    breakEvenUnits,
    cashFlows: table,
  }
}

export function exportScheduleCsv(rows: PaymentRow[]): string {
  const header = 'Месяц;Дата;Платёж;Основной долг;Проценты;Комиссии;Остаток'
  const body = rows
    .map(
      (r) =>
        `${r.month};${r.date};${r.payment};${r.principal};${r.interest};${r.fees};${r.balance}`,
    )
    .join('\n')
  return `${header}\n${body}`
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
