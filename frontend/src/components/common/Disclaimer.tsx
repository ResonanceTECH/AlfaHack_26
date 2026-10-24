import { Alert } from '@mui/material'

export function Disclaimer({ dense }: { dense?: boolean }) {
  return (
    <Alert severity="info" variant="outlined" sx={{ py: dense ? 0 : undefined }}>
      Демонстрационные расчёты и рекомендации не являются официальным решением банка и не гарантируют
      одобрение кредита. Итоговые условия подтверждает Альфа-Банк.
    </Alert>
  )
}
