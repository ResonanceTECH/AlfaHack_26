import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { PaymentScheduleResult } from '@/types'
import { formatMoney, formatDate } from '@/utils/format'

export function PaymentScheduleTable({ result }: { result: PaymentScheduleResult }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Дата</TableCell>
            <TableCell align="right">Платёж</TableCell>
            <TableCell align="right">Основной долг</TableCell>
            <TableCell align="right">Проценты</TableCell>
            <TableCell align="right">Комиссии</TableCell>
            <TableCell align="right">Остаток</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.rows.map((r) => (
            <TableRow key={r.month} hover>
              <TableCell>{r.month}</TableCell>
              <TableCell>{formatDate(r.date)}</TableCell>
              <TableCell align="right">{formatMoney(r.payment, true)}</TableCell>
              <TableCell align="right">{formatMoney(r.principal, true)}</TableCell>
              <TableCell align="right">{formatMoney(r.interest, true)}</TableCell>
              <TableCell align="right">{formatMoney(r.fees, true)}</TableCell>
              <TableCell align="right">{formatMoney(r.balance, true)}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2}>
              <Typography fontWeight={700}>Итого</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography fontWeight={700}>{formatMoney(result.totalPayment, true)}</Typography>
            </TableCell>
            <TableCell align="right">{formatMoney(result.amount, true)}</TableCell>
            <TableCell align="right">{formatMoney(result.totalInterest, true)}</TableCell>
            <TableCell align="right">{formatMoney(result.totalFees, true)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}
