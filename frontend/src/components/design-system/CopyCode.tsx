import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { useState } from 'react'
import { color, font, radius } from '@/theme/tokens'

type CopyCodeProps = {
  code: string
  label?: string
  /** compact = single-line token / snappy copy */
  compact?: boolean
}

export function CopyCode({ code, label, compact }: CopyCodeProps) {
  const [ok, setOk] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setOk(true)
      window.setTimeout(() => setOk(false), 1600)
    } catch {
      /* ignore */
    }
  }

  if (compact) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: 0.5,
          maxWidth: '100%',
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          bgcolor: color.secondary.soft03,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          pl: 1,
          pr: 0.25,
          py: 0.35,
        }}
      >
        {label ? (
          <Typography
            component="span"
            sx={{
              fontSize: 11,
              color: 'text.secondary',
              fontWeight: 600,
              mr: 0.5,
              flexShrink: 0,
              pt: 0.15,
            }}
          >
            {label}
          </Typography>
        ) : null}
        <Typography
          component="code"
          sx={{
            fontFamily: font.mono,
            fontSize: 12,
            color: color.text.primary,
            minWidth: 0,
            flex: 1,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.4,
            py: 0.15,
          }}
        >
          {code}
        </Typography>
        <Tooltip title={ok ? 'Скопировано' : 'Копировать'}>
          <IconButton size="small" onClick={copy} aria-label="Копировать" sx={{ flexShrink: 0 }}>
            {ok ? (
              <CheckRoundedIcon sx={{ fontSize: 14, color: color.semantic.success }} />
            ) : (
              <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#0B1F35',
        color: '#E8EEF5',
        borderRadius: `${radius.button}px`,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        maxWidth: '100%',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.03)',
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label ?? 'TSX / snippet'}
        </Typography>
        <Tooltip title={ok ? 'Скопировано' : 'Копировать код'}>
          <IconButton size="small" onClick={copy} sx={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
            {ok ? (
              <CheckRoundedIcon sx={{ fontSize: 16, color: '#6EE7A8' }} />
            ) : (
              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: { xs: 1.25, sm: 2 },
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          fontFamily: font.mono,
          fontSize: { xs: 11.5, sm: 12.5 },
          lineHeight: 1.55,
          maxHeight: 320,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          boxSizing: 'border-box',
        }}
      >
        {code}
      </Box>
    </Box>
  )
}

type SwatchProps = {
  name: string
  value: string
  /** preview fill; defaults to value if it's a solid color */
  preview?: string
}

export function ColorSwatch({ name, value, preview }: SwatchProps) {
  const fill = preview ?? value
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        height: '100%',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <Box
        sx={{
          height: 72,
          bgcolor: fill.startsWith('linear') || fill.includes('gradient') ? undefined : fill,
          background: fill.includes('gradient') || fill.startsWith('linear') ? fill : undefined,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
      <Box sx={{ p: 1.25, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{name}</Typography>
        <CopyCode code={value} compact />
      </Box>
    </Box>
  )
}
