import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import SyncAltRoundedIcon from '@mui/icons-material/SyncAltRounded'
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined'
import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { createGoal } from '@/api/companies'
import { SelectionStepper } from '@/features/selection/SelectionStepper'
import { loadSelectionDraft, saveSelectionDraft } from '@/features/selection/draft'
import {
  GOAL_OPTIONS,
  WHEN_OPTIONS,
  goalTitle,
  goalTypeOf,
  type GoalOptionKey,
  type SelectionDraft,
} from '@/features/selection/goalOptions'
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney } from '@/utils/format'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const ICONS: Record<GoalOptionKey, ReactNode> = {
  working_capital: <ShoppingCartOutlinedIcon sx={{ fontSize: 22 }} />,
  equipment: <PrecisionManufacturingOutlinedIcon sx={{ fontSize: 22 }} />,
  new_point: <StorefrontOutlinedIcon sx={{ fontSize: 22 }} />,
  cash_gap: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 22 }} />,
  refinance: <SyncAltRoundedIcon sx={{ fontSize: 22 }} />,
  renovation: <HandymanOutlinedIcon sx={{ fontSize: 22 }} />,
}

export function SelectionGoalPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { companyId } = useAppStore()
  const [draft, setDraft] = useState<SelectionDraft>(() => loadSelectionDraft(companyId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(loadSelectionDraft(companyId))
  }, [companyId])

  useEffect(() => {
    saveSelectionDraft(draft, companyId)
  }, [draft, companyId])

  function patch(p: Partial<SelectionDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  async function continueToBudget() {
    setSaving(true)
    try {
      if (companyId) {
        const costs = Object.fromEntries(
          draft.lines.map((l, i) => [`line_${i}`, l.amount]),
        )
        await createGoal({
          companyId,
          goalType: goalTypeOf(draft.goalKey),
          title: goalTitle(draft.goalKey),
          description: draft.description,
          costs,
          reserve: 0,
          ownFunds: 0,
          otherFunding: 0,
          targetDate: new Date().toISOString().slice(0, 10),
          termMonths: draft.termMonths,
        })
        void qc.invalidateQueries({ queryKey: ['goals', companyId] })
      }
    } catch {
      /* demo: continue even if API fails */
    } finally {
      setSaving(false)
      navigate('/app/recommendations/budget')
    }
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        Цель и AI-консультант{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Выбор цели
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 26, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Для чего нужны деньги?
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.55 }}>
            Цель определяет подходящие продукты и документы
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          component={RouterLink}
          to="/app/ai"
          sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}
        >
          Не знаю, помогите
        </Button>
      </Stack>

      <SelectionStepper active={1} />

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
          mb: 2.5,
        }}
      >
        {GOAL_OPTIONS.map((g) => {
          const selected = draft.goalKey === g.key
          return (
            <Box
              key={g.key}
              component="button"
              type="button"
              onClick={() => patch({ goalKey: g.key })}
              sx={{
                ...tileSx,
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
                border: selected ? '1.5px solid #EF3124' : '1px solid rgba(11,31,53,0.08)',
                boxShadow: selected
                  ? '0 0 0 3px rgba(239,49,36,0.12)'
                  : tileSx.boxShadow,
                transition: 'border-color .15s, box-shadow .15s',
                '&:hover': { borderColor: selected ? '#EF3124' : 'rgba(11,31,53,0.2)' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.25 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: selected ? 'rgba(239,49,36,0.1)' : '#F3F5F8',
                    color: selected ? '#EF3124' : '#5A6B7D',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {ICONS[g.key]}
                </Box>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: selected ? '6px solid #EF3124' : '2px solid #C5CCD3',
                    bgcolor: '#fff',
                  }}
                />
              </Stack>
              <Typography sx={{ fontSize: 14.5, fontWeight: 750, color: '#0B1F35', mb: 0.5 }}>
                {g.title}
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#7A8795', lineHeight: 1.4, mb: 1 }}>
                {g.description}
              </Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: '#5A6B7D' }}>
                {g.limit}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.35fr) minmax(260px, 0.85fr)' },
          alignItems: 'start',
        }}
      >
        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 2,
            }}
          >
            Параметры цели
          </Typography>
          <Stack spacing={1.75}>
            <TextField
              label="Сумма"
              fullWidth
              value={draft.amount.toLocaleString('ru-RU')}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''))
                patch({ amount: Number.isFinite(n) ? n : 0 })
              }}
              InputProps={{
                endAdornment: (
                  <Typography sx={{ color: '#9AA5B1', fontWeight: 700, ml: 1 }}>₽</Typography>
                ),
              }}
            />
            <TextField
              label="Срок"
              fullWidth
              value={draft.termMonths}
              onChange={(e) => patch({ termMonths: Math.max(1, Number(e.target.value) || 1) })}
              InputProps={{
                endAdornment: (
                  <Typography sx={{ color: '#9AA5B1', fontWeight: 700, ml: 1 }}>мес</Typography>
                ),
              }}
              inputProps={{ inputMode: 'numeric' }}
            />
            <TextField
              select
              label="Когда нужны деньги"
              fullWidth
              value={draft.whenNeeded}
              onChange={(e) => patch({ whenNeeded: e.target.value })}
            >
              {WHEN_OPTIONS.map((w) => (
                <MenuItem key={w} value={w}>
                  {w}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Короткое описание"
              fullWidth
              multiline
              minRows={2}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.guarantee}
                  onChange={(e) => patch({ guarantee: e.target.checked })}
                  sx={{ color: '#EF3124', '&.Mui-checked': { color: '#EF3124' } }}
                />
              }
              label={
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#0B1F35' }}>
                  Готов предоставить поручительство владельцев
                </Typography>
              }
            />
          </Stack>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.5,
            }}
          >
            Что дальше
          </Typography>
          <Stack spacing={1.35} sx={{ mb: 2.25 }}>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#1B8A5A', mt: 0.1 }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
                Цель сохранена в профиле
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20, color: '#C5CCD3', mt: 0.1 }} />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
                  Бюджет цели
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#9AA5B1' }}>
                  Распределите сумму по статьям
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
              <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 20, color: '#C5CCD3', mt: 0.1 }} />
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 650, color: '#0B1F35' }}>
                  Подбор продуктов
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#9AA5B1' }}>
                  3 продукта по вашему профилю
                </Typography>
              </Box>
            </Stack>
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', mb: 1.5 }}>
            {goalTitle(draft.goalKey)} · {formatMoney(draft.amount)} · {draft.termMonths} мес
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            disabled={saving || draft.amount <= 0}
            onClick={() => void continueToBudget()}
          >
            {saving ? 'Сохраняем…' : 'Продолжить к бюджету →'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
