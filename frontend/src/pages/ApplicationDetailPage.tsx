import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Navigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { getApplication, uploadApplicationDocument } from '@/api/applications'
import { loadLocalApps } from '@/features/applications/localApps'
import { formatMoney, formatDateTime, formatFileSize } from '@/utils/format'
import { statusColors, statusLabels } from '@/data/labels'
import { isEditableApplication } from '@/pages/ApplicationEditPage'
import axios from 'axios'

export function ApplicationDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = Boolean(id && isEditableApplication(id))

  const appQ = useQuery({
    queryKey: ['application', id],
    queryFn: () => getApplication(id!),
    enabled: Boolean(id) && !editable,
    retry: false,
  })

  const localApp = useMemo(
    () => (id ? loadLocalApps().find((a) => a.id === id) : undefined),
    [id, appQ.dataUpdatedAt],
  )

  const app = appQ.data ?? localApp

  if (editable && id) {
    return <Navigate to={`/app/applications/${id}/edit`} replace />
  }

  if (appQ.isLoading && !localApp) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!app) {
    return (
      <EmptyState
        title="Заявка не найдена"
        description="Проверьте список заявок."
        actionLabel="К заявкам"
        actionTo="/app/applications"
      />
    )
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length || !app) return
    setUploading(true)
    setError(null)
    try {
      let current = app
      for (const f of Array.from(files)) {
        current = await uploadApplicationDocument(current.id, f)
      }
      await qc.invalidateQueries({ queryKey: ['application', id] })
      await qc.invalidateQueries({ queryKey: ['applications'] })
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? String(e.response?.data?.detail ?? e.message)
        : e instanceof Error
          ? e.message
          : 'Ошибка загрузки'
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title={app.productName}
        subtitle={`${formatMoney(app.amount)} · ${app.termMonths} мес. · ${app.rate}%`}
        crumbs={[
          { label: 'Заявки', to: '/app/applications' },
          { label: app.id.slice(0, 8) },
        ]}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        <Chip color={statusColors[app.status]} label={statusLabels[app.status]} />
        <Typography variant="body2" color="text.secondary">
          Готовность {app.readinessScore}/100 · обновлено {formatDateTime(app.updatedAt)}
        </Typography>
      </Stack>

      {app.aiSummary && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {app.aiSummary}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 2 }} elevation={1}>
        <Typography variant="h6" gutterBottom>
          Документы
        </Typography>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {app.documents.length === 0 && (
            <Typography color="text.secondary">Документов пока нет</Typography>
          )}
          {app.documents.map((d) => (
            <Typography key={d.id} variant="body2">
              {d.name} · {d.status} · {formatFileSize(d.size)}
            </Typography>
          ))}
        </Stack>
        <Button variant="outlined" component="label" disabled={uploading}>
          {uploading ? 'Загрузка…' : 'Загрузить документ'}
          <input hidden type="file" multiple onChange={(e) => void onUpload(e.target.files)} />
        </Button>
      </Paper>

      <Paper sx={{ p: 2.5 }} elevation={1}>
        <Typography variant="h6" gutterBottom>
          История статусов
        </Typography>
        {app.statusHistory.map((h, i) => (
          <Typography key={i} variant="body2" color="text.secondary">
            {statusLabels[h.status]} — {formatDateTime(String(h.at))} ({h.by})
          </Typography>
        ))}
        {app.comments.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mt: 2 }} gutterBottom>
              Комментарии
            </Typography>
            {app.comments.map((c) => (
              <Typography key={c.id} variant="body2" sx={{ mb: 1 }}>
                <strong>{c.authorName}</strong>: {c.text}
              </Typography>
            ))}
          </>
        )}
      </Paper>
    </Box>
  )
}
