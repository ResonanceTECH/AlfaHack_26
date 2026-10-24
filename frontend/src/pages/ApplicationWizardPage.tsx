import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/common/PageHeader'
import { useAppStore } from '@/hooks/useAppStore'
import { createApplication, submitApplication, uploadApplicationDocument } from '@/api/applications'
import { fetchReadiness } from '@/api/credit'
import { formatMoney } from '@/utils/format'

const steps = ['Продукт и условия', 'Документы', 'Проверка и отправка']

export function ApplicationWizardPage() {
  const { company, goal, selectedProductId, apps, products, companyId } = useAppStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const [productId, setProductId] = useState(selectedProductId ?? '')
  const product = products.find((p) => p.id === productId) ?? products[0]
  const [amount, setAmount] = useState(goal?.requiredAmount ?? 0)
  const [term, setTerm] = useState(goal?.termMonths ?? 12)
  const [rate, setRate] = useState(0)
  const [purpose, setPurpose] = useState(goal?.title ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id)
  }, [products, productId])

  useEffect(() => {
    if (product) setRate((product.rateMin + product.rateMax) / 2)
  }, [product])

  const readinessQ = useQuery({
    queryKey: ['readiness', companyId, product?.id],
    queryFn: () => fetchReadiness({ companyId: companyId!, productId: product!.id }),
    enabled: Boolean(companyId && product),
  })

  function onFile(list: FileList | null) {
    if (!list?.length) return
    const next: File[] = [...files]
    for (const f of Array.from(list)) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`Файл ${f.name} больше 10 МБ`)
        continue
      }
      const ok = /\.(pdf|jpg|jpeg|png|xlsx|csv)$/i.test(f.name)
      if (!ok) {
        setError(`Тип файла ${f.name} не поддерживается`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  async function save(mode: 'draft' | 'submitted') {
    if (!companyId || !product) {
      setError('Нет компании или продукта')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let app = await createApplication({
        companyId,
        productId: product.id,
        amount,
        termMonths: term,
        rate,
        purpose,
      })
      for (const f of files) {
        app = await uploadApplicationDocument(app.id, f)
      }
      if (mode === 'submitted') {
        app = await submitApplication(app.id)
      }
      await qc.invalidateQueries({ queryKey: ['applications'] })
      navigate(`/app/applications/${app.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения заявки')
    } finally {
      setSaving(false)
    }
  }

  if (!company || !product) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        {companyId ? <CircularProgress /> : <Alert severity="warning">Нет компании</Alert>}
      </Box>
    )
  }

  const readiness = readinessQ.data

  return (
    <Box>
      <PageHeader
        title="Оформление заявки"
        subtitle="Предзаполнение из профиля и цели. Можно сохранить черновик или отправить."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={active} sx={{ mb: 3 }}>
        {steps.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3 }} elevation={1}>
        {active === 0 && (
          <Stack spacing={2} maxWidth={520}>
            <TextField
              select
              label="Продукт"
              value={product.id}
              onChange={(e) => setProductId(e.target.value)}
              fullWidth
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Сумма"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              fullWidth
            />
            <TextField
              label="Срок, мес."
              type="number"
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              fullWidth
            />
            <TextField
              label="Цель / назначение"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Typography variant="body2" color="text.secondary">
              Компания: {company.name} · ориентир ставки {rate}% (каталог)
            </Typography>
          </Stack>
        )}

        {active === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Требуемые документы: {product.documents.join(', ')}
            </Typography>
            <Button variant="outlined" component="label">
              Загрузить файлы
              <input hidden type="file" multiple onChange={(e) => onFile(e.target.files)} />
            </Button>
            {files.map((f) => (
              <Typography key={f.name + f.size} variant="body2">
                ✓ {f.name} ({Math.round(f.size / 1024)} КБ)
              </Typography>
            ))}
            {apps[0]?.documents.some((d) => d.status === 'requested') && (
              <Alert severity="warning">
                Есть запрошенные менеджером документы — ответьте в карточке заявки.
              </Alert>
            )}
          </Stack>
        )}

        {active === 2 && (
          <Stack spacing={2}>
            <Alert severity="info">
              Индекс готовности: {readiness ? `${readiness.score}/100` : '…'} (не кредитный рейтинг
              банка)
            </Alert>
            <Typography>
              {product.name}: {formatMoney(amount)} на {term} мес., ставка ≈ {rate}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Документов к загрузке: {files.length}. После отправки заявка появится у менеджера.
            </Typography>
          </Stack>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button disabled={active === 0 || saving} onClick={() => setActive((s) => s - 1)}>
            Назад
          </Button>
          {active < steps.length - 1 ? (
            <Button variant="contained" onClick={() => setActive((s) => s + 1)}>
              Далее
            </Button>
          ) : (
            <>
              <Button variant="outlined" disabled={saving} onClick={() => void save('draft')}>
                Черновик
              </Button>
              <Button variant="contained" disabled={saving} onClick={() => void save('submitted')}>
                {saving ? 'Сохраняем…' : 'Отправить'}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
