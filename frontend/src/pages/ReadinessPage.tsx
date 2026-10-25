import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchReadiness } from '@/api/credit'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/hooks/useAppStore'
import type { ReadinessFactor } from '@/types'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.5 },
} as const

const SCORE = 78

const FACTORS: { label: string; score: number; tone: 'good' | 'mid' | 'warn' }[] = [
  { label: 'Полнота данных компании', score: 92, tone: 'good' },
  { label: 'Финансовая устойчивость', score: 74, tone: 'warn' },
  { label: 'Долговая нагрузка', score: 81, tone: 'good' },
  { label: 'Документы', score: 65, tone: 'mid' },
  { label: 'Кредитная история', score: 88, tone: 'good' },
  { label: 'Обороты по счетам', score: 70, tone: 'warn' },
]

const ACTIONS = [
  {
    action: 'Загрузить договор аренды',
    effect: '+4',
    time: '5 мин',
    cta: 'Загрузить',
    to: '/app/documents',
  },
  {
    action: 'Загрузить декларацию 2025',
    effect: '+3',
    time: '5 мин',
    cta: 'Загрузить',
    to: '/app/documents',
  },
  {
    action: 'Подключить второй счёт',
    effect: '+2',
    time: '10 мин',
    cta: 'Подключить',
    to: '/app/company',
  },
  {
    action: 'Дать согласие на запрос в БКИ',
    effect: '+1',
    time: '1 мин',
    cta: 'Дать',
    to: '/app/profile',
  },
]

const DYNAMICS: { label: string; value: number }[] = [
  { label: 'июн', value: 52 },
  { label: 'июл', value: 58 },
  { label: 'авг', value: 64 },
  { label: 'сен', value: 71 },
  { label: '23 окт', value: 78 },
]

function factorTone(score: number): 'good' | 'mid' | 'warn' {
  if (score >= 80) return 'good'
  if (score >= 65) return 'mid'
  return 'warn'
}

function factorPct(f: ReadinessFactor): number {
  const max = f.maxScore > 0 ? f.maxScore : 100
  return Math.round(Math.min(100, Math.max(0, (f.score / max) * 100)))
}

function recHref(text: string, factor?: ReadinessFactor): string {
  const t = `${text} ${factor?.key ?? ''} ${factor?.label ?? ''}`.toLowerCase()
  if (t.includes('счёт') || t.includes('компани') || t.includes('инн')) return '/app/company'
  if (t.includes('бки') || t.includes('согласи') || t.includes('профиль')) return '/app/profile'
  if (t.includes('заявк')) return '/app/applications'
  return '/app/documents'
}

function recCta(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('согласи')) return 'Дать'
  if (t.includes('подключ')) return 'Подключить'
  if (t.includes('заявк')) return 'Открыть'
  return 'Загрузить'
}

function toneColor(tone: 'good' | 'mid' | 'warn') {
  if (tone === 'good') return '#1B8A5A'
  if (tone === 'mid') return '#A67C52'
  return '#EF3124'
}

function Gauge({ score }: { score: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score)) / 100
  const dash = c * pct

  return (
    <Box sx={{ position: 'relative', width: 160, height: 160, mx: 'auto' }}>
      <Box
        component="svg"
        viewBox="0 0 140 140"
        sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E8ECF0" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#EF3124"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1,
            }}
          >
            {score}
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#9AA5B1', fontWeight: 600, mt: 0.35 }}>
            из 100
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

function Sparkline({ points }: { points: { label: string; value: number }[] }) {
  const w = 320
  const h = 140
  const pad = 12
  const min = Math.min(...points.map((p) => p.value)) - 4
  const max = Math.max(...points.map((p) => p.value)) + 4
  const coords = points.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1)
    const y = h - pad - ((p.value - min) / (max - min)) * (h - pad * 2)
    return { x, y, ...p }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  return (
    <Box>
      <Box component="svg" viewBox={`0 0 ${w} ${h}`} sx={{ width: '100%', height: 160 }}>
        <defs>
          <linearGradient id="readyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(239,49,36,0.18)" />
            <stop offset="100%" stopColor="rgba(239,49,36,0)" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L ${coords[coords.length - 1]!.x} ${h - pad} L ${coords[0]!.x} ${h - pad} Z`}
          fill="url(#readyFill)"
        />
        <path d={path} fill="none" stroke="#EF3124" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r="4" fill="#EF3124" />
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5, mt: -0.5 }}>
        {points.map((p) => (
          <Typography key={p.label} sx={{ fontSize: 11.5, color: '#9AA5B1', fontWeight: 600 }}>
            {p.label}
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

export function ReadinessPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { companyId: storeCompanyId } = useAppStore()
  const companyId = storeCompanyId || user?.companyId
  const [flash, setFlash] = useState<string | null>(null)

  const readyQ = useQuery({
    queryKey: ['readiness', companyId],
    queryFn: () => fetchReadiness({ companyId: companyId! }),
    enabled: !!companyId,
  })

  const score = readyQ.data?.score ?? SCORE
  const factors = useMemo(() => {
    const raw = readyQ.data?.factors
    if (!raw?.length) return FACTORS
    return raw.map((f) => {
      const pct = factorPct(f)
      return { label: f.label || f.key, score: pct, tone: factorTone(pct) }
    })
  }, [readyQ.data])

  const actions = useMemo(() => {
    const raw = readyQ.data?.factors
    if (!raw?.length) return ACTIONS
    const derived: typeof ACTIONS = []
    for (const f of raw) {
      for (const rec of f.recommendations) {
        derived.push({
          action: rec,
          effect: '+',
          time: '—',
          cta: recCta(rec),
          to: recHref(rec, f),
        })
      }
      for (const miss of f.missing) {
        derived.push({
          action: miss,
          effect: '+',
          time: '—',
          cta: recCta(miss),
          to: recHref(miss, f),
        })
      }
    }
    return derived.length ? derived.slice(0, 6) : ACTIONS
  }, [readyQ.data])

  const dynamics = useMemo(() => {
    const prev = DYNAMICS.slice(0, -1)
    return [...prev, { label: 'сейчас', value: score }]
  }, [score])

  const label = useMemo(() => {
    if (score >= 80) return { text: 'Отличная готовность', color: '#1B8A5A', bg: '#E6F5EE' }
    if (score >= 65) return { text: 'Хорошая готовность', color: '#1B8A5A', bg: '#E6F5EE' }
    if (score >= 45) return { text: 'Средняя готовность', color: '#C45A12', bg: '#FFF0E0' }
    return { text: 'Низкая готовность', color: '#C41E14', bg: '#FDE8E6' }
  }, [score])

  function recalc() {
    if (!companyId) return
    void readyQ.refetch().then(() => {
      setFlash('Индекс пересчитан')
      window.setTimeout(() => setFlash(null), 1800)
    })
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 2 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        <Box
          component={RouterLink}
          to="/app/statements"
          sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
        >
          Финансовый профиль
        </Box>{' '}
        <Box component="span" sx={{ color: '#C5CCD3' }}>
          /
        </Box>{' '}
        <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
          Индекс готовности
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: { xs: 24, md: 28 },
              letterSpacing: '-0.03em',
              color: '#0B1F35',
              lineHeight: 1.2,
            }}
          >
            Индекс готовности к кредиту
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.6 }}>
            Насколько компания готова к рассмотрению заявки прямо сейчас
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            onClick={recalc}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Пересчитать
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              const el = document.getElementById('improve-index')
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            Улучшить индекс
          </Button>
        </Stack>
      </Stack>

      {readyQ.isLoading && !readyQ.data && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 2, mb: 1 }}>
          <CircularProgress size={26} sx={{ color: '#EF3124' }} />
        </Box>
      )}
      {readyQ.isError && !readyQ.data && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#FDE8E6',
            color: '#C41E14',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Не удалось загрузить индекс — показан ориентир
        </Box>
      )}
      {flash && (
        <Box
          sx={{
            mb: 2,
            px: 1.75,
            py: 1.1,
            borderRadius: 2,
            bgcolor: '#E6F5EE',
            color: '#1B8A5A',
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {flash}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 0.85fr) minmax(0, 1.15fr)' },
          mb: 2,
        }}
      >
        <Box sx={{ ...tileSx, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#9AA5B1', mb: 1.5 }}>
            Ваш индекс
          </Typography>
          <Gauge score={score} />
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              mt: 1.5,
              px: 1.15,
              py: 0.4,
              borderRadius: 999,
              bgcolor: label.bg,
              color: label.color,
              fontSize: 12.5,
              fontWeight: 800,
            }}
          >
            {label.text}
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1B8A5A', mt: 1.25 }}>
            +6 за последние 30 дней
          </Typography>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Из чего складывается
          </Typography>
          <Stack spacing={1.35}>
            {factors.map((f) => (
              <Box key={f.label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.55 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                    {f.label}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 13.5, fontWeight: 800, color: toneColor(f.tone) }}
                  >
                    {f.score}
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    height: 8,
                    borderRadius: 999,
                    bgcolor: '#EEF1F4',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${f.score}%`,
                      height: '100%',
                      borderRadius: 999,
                      bgcolor: toneColor(f.tone),
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(260px, 0.85fr)' },
          mb: 2,
        }}
      >
        <Box id="improve-index" sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1.75,
            }}
          >
            Как повысить индекс
          </Typography>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr">
                {['Действие', 'Эффект', 'Время', ''].map((h, i) => (
                  <Box
                    component="th"
                    key={h || 'cta'}
                    sx={{
                      textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#9AA5B1',
                      pb: 1.1,
                      pr: i === 3 ? 0 : 1.25,
                      borderBottom: '1px solid rgba(11,31,53,0.08)',
                    }}
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {actions.map((a) => (
                <Box
                  component="tr"
                  key={a.action}
                  sx={{
                    '& td': {
                      py: 1.25,
                      pr: 1.25,
                      borderBottom: '1px solid rgba(11,31,53,0.06)',
                      verticalAlign: 'middle',
                    },
                  }}
                >
                  <Box component="td">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35' }}>
                      {a.action}
                    </Typography>
                  </Box>
                  <Box component="td">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#1B8A5A' }}>
                      {a.effect}
                    </Typography>
                  </Box>
                  <Box component="td">
                    <Typography sx={{ fontSize: 13, color: '#7A8795' }}>{a.time}</Typography>
                  </Box>
                  <Box component="td" sx={{ pr: '0 !important', textAlign: 'right' }}>
                    <Button
                      size="small"
                      onClick={() => navigate(a.to)}
                      sx={{
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#EF3124',
                        minWidth: 0,
                        px: 0.5,
                      }}
                    >
                      {a.cta}
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={tileSx}>
          <Typography
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 16,
              color: '#0B1F35',
              mb: 1,
            }}
          >
            Динамика индекса
          </Typography>
          <Sparkline points={dynamics} />
        </Box>
      </Box>

      <Box
        sx={{
          px: 1.75,
          py: 1.4,
          borderRadius: 2.5,
          bgcolor: '#FFF8EB',
          border: '1px solid rgba(196,90,18,0.18)',
        }}
      >
        <Typography sx={{ fontSize: 13, color: '#7A5A3A', lineHeight: 1.5 }}>
          Индекс — ориентир для подготовки, а не решение банка. Заявку всё равно смотрит менеджер
          по документам и оборотам.
        </Typography>
      </Box>
    </Box>
  )
}
