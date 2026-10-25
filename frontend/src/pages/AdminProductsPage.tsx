import Grid from '@mui/material/Grid2'
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { color, font, radius, shadow } from '@/theme/tokens'
import { formatMoney } from '@/utils/format'

type ProductStatus = 'active' | 'draft' | 'hidden'

type Requirement = {
  param: string
  condition: string
  hard: boolean
  ruleId: string
}

type CatalogProduct = {
  id: string
  name: string
  type: string
  rateFrom: number
  amountMax: number
  termMax: number
  commissionPct: number
  status: ProductStatus
  version: number
  draftVersion: number
  goals: string
  showInSelection: boolean
  allowCounteroffer: boolean
  requirements: Requirement[]
}

const tileSx = {
  bgcolor: color.background.paper,
  borderRadius: 3,
  border: `1px solid ${color.semantic.divider}`,
  boxShadow: shadow.paper1,
  p: { xs: 1.5, md: 2 },
} as const

const statusMeta: Record<ProductStatus, { label: string; bgcolor: string; color: string }> = {
  active: {
    label: 'Активен',
    bgcolor: 'rgba(27,138,90,0.1)',
    color: color.semantic.success,
  },
  draft: {
    label: 'Черновик',
    bgcolor: 'rgba(217,119,6,0.12)',
    color: color.semantic.warning,
  },
  hidden: {
    label: 'Скрыт',
    bgcolor: color.secondary.soft06,
    color: color.text.secondary,
  },
}

const CATALOG: CatalogProduct[] = [
  {
    id: 'P-101',
    name: 'Бизнес-Оборот',
    type: 'Оборотный',
    rateFrom: 17.3,
    amountMax: 10_000_000,
    termMax: 36,
    commissionPct: 0,
    status: 'active',
    version: 7,
    draftVersion: 8,
    goals: 'Оборотные средства · Кассовый разрыв',
    showInSelection: true,
    allowCounteroffer: true,
    requirements: [
      { param: 'Возраст бизнеса', condition: '≥ 12 мес.', hard: true, ruleId: 'R-101' },
      { param: 'Выручка за 12 мес', condition: '≥ 6 млн ₽', hard: true, ruleId: 'R-118' },
      { param: 'Просрочки в БКИ', condition: '0 за 12 мес.', hard: true, ruleId: 'R-204' },
      { param: 'DSCR', condition: '≥ 1,3x', hard: false, ruleId: 'R-310' },
    ],
  },
  {
    id: 'P-102',
    name: 'Овердрафт Бизнес',
    type: 'Овердрафт',
    rateFrom: 16.9,
    amountMax: 3_000_000,
    termMax: 12,
    commissionPct: 0.5,
    status: 'active',
    version: 4,
    draftVersion: 4,
    goals: 'Кассовый разрыв',
    showInSelection: true,
    allowCounteroffer: false,
    requirements: [
      { param: 'Среднемес. обороты', condition: '≥ 1 млн ₽', hard: true, ruleId: 'R-140' },
      { param: 'Срок счёта в банке', condition: '≥ 6 мес.', hard: true, ruleId: 'R-141' },
    ],
  },
  {
    id: 'P-103',
    name: 'Бизнес-Рост',
    type: 'Инвестиционный',
    rateFrom: 18.5,
    amountMax: 30_000_000,
    termMax: 60,
    commissionPct: 0,
    status: 'active',
    version: 5,
    draftVersion: 5,
    goals: 'Оборудование · Точка',
    showInSelection: true,
    allowCounteroffer: true,
    requirements: [
      { param: 'Возраст бизнеса', condition: '≥ 18 мес.', hard: true, ruleId: 'R-102' },
      { param: 'Залог / поручительство', condition: 'обязательно', hard: true, ruleId: 'R-401' },
      { param: 'DSCR', condition: '≥ 1,2x', hard: false, ruleId: 'R-311' },
    ],
  },
  {
    id: 'P-104',
    name: 'Кредитная линия МСБ',
    type: 'Линия',
    rateFrom: 17.9,
    amountMax: 15_000_000,
    termMax: 24,
    commissionPct: 0.3,
    status: 'active',
    version: 3,
    draftVersion: 3,
    goals: 'Оборотные средства',
    showInSelection: true,
    allowCounteroffer: true,
    requirements: [
      { param: 'Выручка за 12 мес', condition: '≥ 12 млн ₽', hard: true, ruleId: 'R-119' },
    ],
  },
  {
    id: 'P-105',
    name: 'Сезонный оборот',
    type: 'Оборотный',
    rateFrom: 19.1,
    amountMax: 5_000_000,
    termMax: 18,
    commissionPct: 0,
    status: 'hidden',
    version: 2,
    draftVersion: 2,
    goals: 'Закупка товаров',
    showInSelection: false,
    allowCounteroffer: false,
    requirements: [
      { param: 'Сезонность выручки', condition: 'подтверждена', hard: false, ruleId: 'R-520' },
    ],
  },
  {
    id: 'P-106',
    name: 'Экспресс 500',
    type: 'Оборотный',
    rateFrom: 21.0,
    amountMax: 500_000,
    termMax: 12,
    commissionPct: 1,
    status: 'draft',
    version: 1,
    draftVersion: 1,
    goals: 'Кассовый разрыв',
    showInSelection: false,
    allowCounteroffer: false,
    requirements: [
      { param: 'Возраст бизнеса', condition: '≥ 6 мес.', hard: true, ruleId: 'R-103' },
    ],
  },
]

function shortAmount(n: number): string {
  if (n >= 1_000_000) return `до ${(n / 1_000_000).toLocaleString('ru-RU')} млн`
  if (n >= 1_000) return `до ${Math.round(n / 1_000)} тыс`
  return formatMoney(n)
}

export function AdminProductsPage() {
  const [products, setProducts] = useState(CATALOG)
  const [selectedId, setSelectedId] = useState('P-101')
  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0]!,
    [products, selectedId],
  )

  const [draft, setDraft] = useState(() => ({ ...CATALOG[0]! }))

  function selectProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setSelectedId(id)
    setDraft({ ...p })
  }

  function resetDraft() {
    setDraft({ ...selected })
  }

  function saveDraft() {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === draft.id
          ? {
              ...draft,
              draftVersion: draft.draftVersion + (draft.status === 'active' ? 1 : 0),
            }
          : p,
      ),
    )
  }

  const activeCount = products.filter((p) => p.status === 'active').length

  return (
    <Box>
      <PageHeader
        title="Каталог продуктов"
        subtitle={`Версия каталога 2026.4 · ${products.length} продуктов · ${activeCount} активных`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileUploadOutlinedIcon />}
              sx={{
                borderColor: color.secondary.soft08,
                color: color.text.primary,
                bgcolor: color.background.paper,
                borderRadius: `${radius.button}px`,
                fontWeight: 600,
              }}
            >
              Импорт
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: `${radius.button}px`, fontWeight: 600 }}
            >
              Новый продукт
            </Button>
          </>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ ...tileSx, mb: 2, overflow: 'auto' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Продукт</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Тип</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Ставка</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Сумма</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Срок</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Статус</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Вер.</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((p) => {
                  const sm = statusMeta[p.status]
                  return (
                    <TableRow
                      key={p.id}
                      hover
                      selected={p.id === selectedId}
                      onClick={() => selectProduct(p.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: color.text.muted }}>
                          {p.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 650 }}>{p.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, color: color.text.secondary }}>{p.type}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13 }}>от {p.rateFrom.toLocaleString('ru-RU')}%</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13 }}>{shortAmount(p.amountMax)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 13 }}>{p.termMax} мес</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={sm.label}
                          sx={{
                            bgcolor: sm.bgcolor,
                            color: sm.color,
                            fontWeight: 700,
                            fontSize: 11.5,
                            height: 24,
                            borderRadius: `${radius.chip}px`,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 12.5, color: color.text.muted }}>v{p.version}</Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ ...tileSx, overflow: 'auto' }}>
            <Typography
              sx={{
                fontFamily: font.display,
                fontWeight: 700,
                fontSize: 15,
                mb: 1.25,
                color: color.text.primary,
              }}
            >
              Требования к заёмщику · {selected.name}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Параметр</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Условие</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: color.text.secondary }}>
                    Жёсткое
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: color.text.secondary }}>Правило</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selected.requirements.map((r) => (
                  <TableRow key={r.ruleId}>
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5 }}>{r.param}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{r.condition}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.hard ? (
                        <CheckRoundedIcon sx={{ fontSize: 18, color: color.semantic.success }} />
                      ) : (
                        <CloseRoundedIcon sx={{ fontSize: 18, color: color.text.inactive }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: color.text.muted,
                          fontFamily: font.mono,
                        }}
                      >
                        {r.ruleId}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={tileSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography
                sx={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontSize: 15,
                  color: color.text.primary,
                }}
              >
                Редактирование: {draft.id}
              </Typography>
              <Chip
                size="small"
                label={`Черновик v${draft.draftVersion}`}
                sx={{
                  bgcolor: 'rgba(217,119,6,0.12)',
                  color: color.semantic.warning,
                  fontWeight: 700,
                  fontSize: 11,
                  height: 24,
                }}
              />
            </Stack>

            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              <TextField
                size="small"
                label="Название"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Ставка от, %"
                type="number"
                value={draft.rateFrom}
                onChange={(e) => setDraft((d) => ({ ...d, rateFrom: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Сумма до, ₽"
                type="number"
                value={draft.amountMax}
                onChange={(e) => setDraft((d) => ({ ...d, amountMax: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Срок до, мес"
                type="number"
                value={draft.termMax}
                onChange={(e) => setDraft((d) => ({ ...d, termMax: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Комиссия, %"
                type="number"
                value={draft.commissionPct}
                onChange={(e) => setDraft((d) => ({ ...d, commissionPct: Number(e.target.value) }))}
                fullWidth
              />
              <TextField
                select
                size="small"
                label="Цели"
                value={draft.goals}
                onChange={(e) => setDraft((d) => ({ ...d, goals: e.target.value }))}
                fullWidth
              >
                <MenuItem value="Оборотные средства · Кассовый разрыв">
                  Оборотные средства · Кассовый разрыв
                </MenuItem>
                <MenuItem value="Кассовый разрыв">Кассовый разрыв</MenuItem>
                <MenuItem value="Оборудование · Точка">Оборудование · Точка</MenuItem>
                <MenuItem value="Оборотные средства">Оборотные средства</MenuItem>
                <MenuItem value="Закупка товаров">Закупка товаров</MenuItem>
              </TextField>

              <FormControlLabel
                control={
                  <Switch
                    checked={draft.showInSelection}
                    onChange={(_, v) => setDraft((d) => ({ ...d, showInSelection: v }))}
                    color="success"
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Показывать в подборе</Typography>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.allowCounteroffer}
                    onChange={(_, v) => setDraft((d) => ({ ...d, allowCounteroffer: v }))}
                    color="success"
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Разрешить counteroffer</Typography>
                }
              />

              <Button
                fullWidth
                variant="contained"
                onClick={saveDraft}
                sx={{ borderRadius: `${radius.button}px`, fontWeight: 700, py: 1.1 }}
              >
                Сохранить
              </Button>
              <Button
                fullWidth
                variant="outlined"
                onClick={resetDraft}
                sx={{
                  borderRadius: `${radius.button}px`,
                  fontWeight: 600,
                  borderColor: color.secondary.soft08,
                  color: color.text.primary,
                }}
              >
                Отменить
              </Button>
              <Typography sx={{ fontSize: 12, color: color.text.muted, textAlign: 'center' }}>
                Изменение уйдёт на согласование
              </Typography>
            </Stack>
          </Box>
        </Grid>
      </Grid>

    </Box>
  )
}
