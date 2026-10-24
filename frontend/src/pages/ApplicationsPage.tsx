import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useAppStore } from '@/hooks/useAppStore'
import { formatMoney, formatDateTime } from '@/utils/format'
import { statusColors, statusLabels } from '@/data/labels'

export function ApplicationsPage() {
  const { apps } = useAppStore()

  return (
    <Box>
      <PageHeader
        title="Заявки"
        subtitle="Черновики, отправка, статусы и запросы документов от менеджера."
        actions={
          <Button component={RouterLink} to="/app/applications/new" variant="contained">
            Новая заявка
          </Button>
        }
      />

      {apps.length === 0 ? (
        <EmptyState
          title="Заявок пока нет"
          description="Выберите продукт в рекомендациях и оформите заявку."
          actionLabel="К подбору"
          actionTo="/app/recommendations"
        />
      ) : (
        <Paper elevation={1}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Продукт</TableCell>
                <TableCell>Сумма</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Менеджер</TableCell>
                <TableCell>Обновлено</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {apps.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{a.productName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatMoney(a.amount)} · {a.termMonths} мес.
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColors[a.status]} label={statusLabels[a.status]} />
                  </TableCell>
                  <TableCell>{a.assignedManagerName ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(a.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/app/applications/${a.id}`} size="small">
                      Открыть
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Stack sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Workflow: draft → submitted → in_review → docs_requested ↔ in_review → approved/rejected → issued
        </Typography>
      </Stack>
    </Box>
  )
}
