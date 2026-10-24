import { Box, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

const TOTAL_SEC = 30 * 60

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function LinkExpiryTimer({
  active,
  resetKey = 0,
  size = 72,
}: {
  /** When true — live countdown from 30:00. When false — frozen at 30:00. */
  active: boolean
  /** Bump to restart (e.g. after resend). */
  resetKey?: number
  size?: number
}) {
  const [left, setLeft] = useState(TOTAL_SEC)

  useEffect(() => {
    setLeft(TOTAL_SEC)
    if (!active) return

    const started = Date.now()
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setLeft(Math.max(0, TOTAL_SEC - elapsed))
    }, 250)

    return () => window.clearInterval(id)
  }, [active, resetKey])

  const progress = left / TOTAL_SEC
  const expired = active && left === 0
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * progress

  const minutesLeft = Math.ceil(left / 60) || 0

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        px: 1.75,
        py: 1.5,
        borderRadius: 2.5,
        bgcolor: expired ? '#FDECEA' : '#F7F8FA',
        border: '1px solid',
        borderColor: expired ? 'rgba(239,49,36,0.25)' : '#E8ECF1',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <Box
          component="svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          sx={{ display: 'block', transform: 'rotate(-90deg)' }}
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E4E8EE"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={expired ? '#EF3124' : '#EF3124'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray 0.35s ease' }}
          />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Typography
            key={active ? minutesLeft : 'static'}
            sx={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: size > 64 ? 22 : 18,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: expired ? '#EF3124' : '#0B1F35',
              animation: active && !expired ? 'tickPop 0.35s ease' : 'none',
              '@keyframes tickPop': {
                '0%': { transform: 'scale(1.18)', opacity: 0.55 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
            }}
          >
            {expired ? '0' : active ? minutesLeft : 30}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            color: expired ? '#EF3124' : '#0B1F35',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {expired
            ? 'Ссылка истекла'
            : active
              ? `Действует ещё ${minutesLeft} мин`
              : 'Ссылка действует 30 минут'}
        </Typography>
        <Typography
          sx={{
            mt: 0.35,
            fontSize: 12.5,
            color: '#8A94A6',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {expired ? 'Запросите новую ниже' : active ? formatMmSs(left) : 'Проверьте «Спам»'}
        </Typography>
      </Box>
    </Box>
  )
}
