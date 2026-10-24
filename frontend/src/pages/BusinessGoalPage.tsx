import Grid from '@mui/material/Grid2'
import CheckIcon from '@mui/icons-material/Check'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { StatBlock } from '@/components/common/StatBlock'
import {
  goalCostFields,
  goalDescriptions,
  goalLabels,
  goalTypeOrder,
} from '@/data/labels'
import type { GoalType } from '@/types'
import { calcRequiredAmount } from '@/utils/finance'
import { formatMoney } from '@/utils/format'
import { useAppStore } from '@/hooks/useAppStore'
import { createGoal } from '@/api/companies'
import { useQueryClient } from '@tanstack/react-query'

const steps = ['Цель', 'Бюджет', 'Потребность']

const goalIcons: Record<GoalType, ReactNode> = {
  inventory_purchase: <ShoppingCartOutlinedIcon sx={{ fontSize: 22 }} />,
  new_point: <StorefrontOutlinedIcon sx={{ fontSize: 22 }} />,
  equipment: <PrecisionManufacturingOutlinedIcon sx={{ fontSize: 22 }} />,
  production_expansion: <ShieldOutlinedIcon sx={{ fontSize: 22 }} />,
  cash_gap: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 22 }} />,
  other: <AddCircleOutlineIcon sx={{ fontSize: 22 }} />,
}

export function BusinessGoalPage() {
  const { goal: existing, companyId } = useAppStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const [goalType, setGoalType] = useState<GoalType>(existing?.goalType ?? 'inventory_purchase')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [costs, setCosts] = useState<Record<string, number>>(existing?.costs ?? {})
  const [reserve, setReserve] = useState(existing?.reserve ?? 0)
  const [ownFunds, setOwnFunds] = useState(existing?.ownFunds ?? 0)
  const [otherFunding, setOtherFunding] = useState(existing?.otherFunding ?? 0)
  const [targetDate, setTargetDate] = useState(
    existing?.targetDate ?? new Date().toISOString().slice(0, 10),
  )
  const [termMonths, setTermMonths] = useState(existing?.termMonths ?? 12)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fields = goalCostFields[goalType]
  const required = useMemo(
    () => calcRequiredAmount({ costs, reserve, ownFunds, otherFunding }),
    [costs, reserve, ownFunds, otherFunding],
  )
  const costsSum = Object.values(costs).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (!existing) return
    setGoalType(existing.goalType)
    setTitle(existing.title)
    setDescription(existing.description ?? '')
    setCosts(existing.costs)
    setReserve(existing.reserve)
    setOwnFunds(existing.ownFunds)
    setOtherFunding(existing.otherFunding)
    setTargetDate(existing.targetDate)
    setTermMonths(existing.termMonths)
  }, [existing])

  function onGoalTypeChange(next: GoalType) {
    setGoalType(next)
    const nextCosts: Record<string, number> = {}
    for (const f of goalCostFields[next]) {
      nextCosts[f.key] = costs[f.key] ?? 0
    }
    setCosts(nextCosts)
    if (!title || title === goalLabels[goalType]) {
      setTitle(goalLabels[next])
    }
  }

  async function onFinish() {
    if (!companyId) {
      setError('Нет компании — сначала создайте профиль компании')
      return
    }
    setError(null)
    try {
      await createGoal({
        companyId,
        goalType,
        title: title.trim() || goalLabels[goalType],
        description: description || undefined,
        costs,
        reserve,
        ownFunds,
        otherFunding,
        targetDate,
        termMonths,
      })
      await qc.invalidateQueries({ queryKey: ['goals', companyId] })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения цели')
    }
  }

  return (
    <Box>
      <PageHeader
        title="Зачем вам кредит"
        subtitle="Выберите цель — подберём продукты и посчитаем оптимальную сумму"
        crumbs={[{ label: 'Кабинет', to: '/app' }, { label: 'Цель кредита' }]}
      />

      <Stepper activeStep={active} sx={{ mb: 3, maxWidth: 520 }}>
        {steps.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {saved && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/app/recommendations')}>
              К подбору
            </Button>
          }
        >
          Цель сохранена. Потребность {formatMoney(required)} влияет на рекомендации.
        </Alert>
      )}

      {active === 0 ? (
        <GoalSelectStep
          goalType={goalType}
          onSelect={onGoalTypeChange}
          title={title}
          description={description}
          onTitle={setTitle}
          onDescription={setDescription}
          targetDate={targetDate}
          onTargetDate={setTargetDate}
          termMonths={termMonths}
          onTermMonths={setTermMonths}
          onNext={() => setActive(1)}
        />
      ) : (
        <Paper sx={{ p: 3 }} elevation={1}>
          {active === 1 && (
            <Stack spacing={2} maxWidth={560}>
              <Typography color="text.secondary">
                Статьи бюджета для «{goalLabels[goalType]}»
              </Typography>
              {fields.map((f) => (
                <TextField
                  key={f.key}
                  label={f.label}
                  type="number"
                  value={costs[f.key] ?? 0}
                  onChange={(e) => setCosts({ ...costs, [f.key]: Number(e.target.value) })}
                  fullWidth
                />
              ))}
              <TextField
                label="Резерв"
                type="number"
                value={reserve}
                onChange={(e) => setReserve(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Собственные средства"
                type="number"
                value={ownFunds}
                onChange={(e) => setOwnFunds(Number(e.target.value))}
                fullWidth
              />
              <TextField
                label="Подтверждённое иное финансирование"
                type="number"
                value={otherFunding}
                onChange={(e) => setOtherFunding(Number(e.target.value))}
                fullWidth
              />
            </Stack>
          )}

          {active === 2 && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatBlock label="Затраты" value={formatMoney(costsSum)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatBlock
                    label="Резерв − свои − иное"
                    value={formatMoney(reserve - ownFunds - otherFunding)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <StatBlock label="Потребность" value={formatMoney(required)} accent />
                </Grid>
              </Grid>
              <Typography color="text.secondary">
                Рекомендуемый тип: для «{goalLabels[goalType]}» обычно смотрят оборотный кредит /
                кредитную линию
                {goalType === 'equipment' || goalType === 'new_point'
                  ? ' или инвестиционный кредит'
                  : ''}
                .
              </Typography>
            </Box>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button onClick={() => setActive((s) => s - 1)}>Назад</Button>
            {active < steps.length - 1 ? (
              <Button variant="contained" onClick={() => setActive((s) => s + 1)}>
                Далее
              </Button>
            ) : (
              <Button variant="contained" onClick={() => void onFinish()}>
                Сохранить цель
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}

function GoalSelectStep({
  goalType,
  onSelect,
  title,
  description,
  onTitle,
  onDescription,
  targetDate,
  onTargetDate,
  termMonths,
  onTermMonths,
  onNext,
}: {
  goalType: GoalType
  onSelect: (g: GoalType) => void
  title: string
  description: string
  onTitle: (v: string) => void
  onDescription: (v: string) => void
  targetDate: string
  onTargetDate: (v: string) => void
  termMonths: number
  onTermMonths: (v: number) => void
  onNext: () => void
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.45rem', sm: '1.75rem' },
          letterSpacing: '-0.03em',
          mb: 1,
          lineHeight: 1.2,
        }}
      >
        Для какой цели вам нужен кредит?
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 15, mb: 3, maxWidth: 640, lineHeight: 1.45 }}>
        Выберите цель, чтобы мы предложили подходящие продукты и рассчитали оптимальную сумму
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 2,
          mb: 2.5,
        }}
      >
        {goalTypeOrder.map((type) => {
          const selected = goalType === type
          return (
            <ButtonBase
              key={type}
              onClick={() => onSelect(type)}
              sx={{
                display: 'block',
                textAlign: 'left',
                p: 2.25,
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: '#fff',
                boxShadow: selected ? '0 0 0 1px #EF3124' : 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                position: 'relative',
                '&:hover': {
                  borderColor: selected ? 'primary.main' : 'rgba(11,31,53,0.28)',
                },
              }}
            >
              {selected ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 14 }} />
                </Box>
              ) : null}

              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(239,49,36,0.1)',
                  color: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 1.5,
                }}
              >
                {goalIcons[type]}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5, pr: 3 }}>
                {goalLabels[type]}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.4 }}>
                {goalDescriptions[type]}
              </Typography>
            </ButtonBase>
          )
        })}
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2.25,
          mb: 2.5,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack spacing={2} maxWidth={640}>
          <TextField
            label="Название цели"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            fullWidth
            placeholder={goalLabels[goalType]}
          />
          <TextField
            label="Описание"
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder={
              goalType === 'other'
                ? 'Опишите цель своими словами'
                : 'Необязательно — уточните детали'
            }
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Дата потребности"
              type="date"
              value={targetDate}
              onChange={(e) => onTargetDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Желаемый срок, мес."
              type="number"
              value={termMonths}
              onChange={(e) => onTermMonths(Number(e.target.value))}
              fullWidth
            />
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          gap: 2,
          p: 2.25,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: 'rgba(239,49,36,0.06)',
          border: '1px solid',
          borderColor: 'rgba(239,49,36,0.12)',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            bgcolor: 'rgba(239,49,36,0.12)',
            color: 'primary.main',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SmartToyOutlinedIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 14.5, mb: 0.25 }}>AI-помощник</Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', lineHeight: 1.4 }}>
            Не уверены, какую цель выбрать? Расскажите о вашей задаче — я помогу определиться с
            подходящим вариантом.
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/app/ai"
          variant="outlined"
          startIcon={<ChatBubbleOutlineIcon />}
          sx={{
            flexShrink: 0,
            bgcolor: '#fff',
            borderColor: 'divider',
            color: 'text.primary',
            fontWeight: 600,
            borderRadius: 2,
            px: 2,
            '&:hover': { borderColor: 'primary.main', bgcolor: '#fff' },
          }}
        >
          Задать вопрос
        </Button>
      </Box>

      <Button variant="contained" size="large" onClick={onNext} sx={{ px: 4, borderRadius: 2 }}>
        Далее
      </Button>
    </Box>
  )
}
