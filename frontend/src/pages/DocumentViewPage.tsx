import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'

const tileSx = {
  bgcolor: '#fff',
  borderRadius: 3,
  border: '1px solid rgba(11,31,53,0.06)',
  boxShadow: '0 1px 8px rgba(11,31,53,0.04)',
  p: { xs: 2, md: 2.25 },
} as const

const APP_ID = 'ABC-2026-1042'
const AMOUNT = '3 000 000 ₽'
const TERM = '24 мес.'
const RATE = '17,9%'
const PAYMENT = '154 000 ₽'

const PAYMENTS = [
  { date: '28.11.2026', amount: '154 000', rest: '2 890 000' },
  { date: '28.12.2026', amount: '154 000', rest: '2 776 000' },
  { date: '28.01.2027', amount: '154 000', rest: '2 660 000' },
  { date: '28.02.2027', amount: '154 000', rest: '2 542 000' },
]

const DOC_TITLES: Record<string, string> = {
  d1: 'Устав ООО «Кофе Плюс»',
  d2: 'Бух. отчётность 2025',
  d3: 'Выписка по расчётному счёту',
  d5: 'Паспорт владельца',
  d6: 'Согласие на обработку ПДн',
  d8: 'Выписка из ЕГРЮЛ',
  contract: 'Демонстрационный договор',
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircleRoundedIcon sx={{ fontSize: 22, color: '#1B8A5A' }} />
  ) : (
    <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 22, color: '#C5CCD3' }} />
  )
}

export function DocumentViewPage() {
  const { docId, id: appId } = useParams<{ docId?: string; id?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const isContractRoute = Boolean(appId) || docId === 'contract' || params.get('type') === 'contract'
  const applicationId = appId || params.get('app') || APP_ID
  const title =
    isContractRoute
      ? 'Демонстрационный договор'
      : DOC_TITLES[docId ?? ''] || 'Просмотр документа'

  const [agreed, setAgreed] = useState(true)
  const [borrowerSigned, setBorrowerSigned] = useState(false)
  const [bankSigned, setBankSigned] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const conditionsAccepted = true

  function downloadPdf() {
    setFlash('PDF скачивается (демо)')
    window.setTimeout(() => setFlash(null), 2000)
  }

  function startSign() {
    if (!agreed) {
      setFlash('Отметьте согласие с условиями')
      window.setTimeout(() => setFlash(null), 2000)
      return
    }
    setSmsOpen(true)
  }

  function confirmSms() {
    if (smsCode.trim().length < 4) return
    setSmsOpen(false)
    setBorrowerSigned(true)
    window.setTimeout(() => {
      setBankSigned(true)
      setFlash('Договор подписан (демо)')
    }, 700)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 3 }}>
      <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 1.25 }}>
        {isContractRoute ? (
          <>
            <Box
              component={RouterLink}
              to="/app/applications"
              sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
            >
              Мои заявки
            </Box>{' '}
            <Box component="span" sx={{ color: '#C5CCD3' }}>
              /
            </Box>{' '}
            <Box
              component={RouterLink}
              to={`/app/applications/${applicationId}/edit`}
              sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
            >
              {applicationId}
            </Box>{' '}
            <Box component="span" sx={{ color: '#C5CCD3' }}>
              /
            </Box>{' '}
            <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
              Договор
            </Box>
          </>
        ) : (
          <>
            <Box
              component={RouterLink}
              to="/app/documents"
              sx={{ color: '#9AA5B1', textDecoration: 'none', '&:hover': { color: '#EF3124' } }}
            >
              Документы
            </Box>{' '}
            <Box component="span" sx={{ color: '#C5CCD3' }}>
              /
            </Box>{' '}
            <Box component="span" sx={{ color: '#5A6B7D', fontWeight: 600 }}>
              {title}
            </Box>
          </>
        )}
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
            {title}
          </Typography>
          <Typography sx={{ color: '#7A8795', fontSize: 14, mt: 0.65, lineHeight: 1.45 }}>
            {isContractRoute
              ? 'Проверьте документ и подпишите простой электронной подписью (демо)'
              : 'Просмотр загруженного файла · демо-превью'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DownloadRoundedIcon />}
            onClick={downloadPdf}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Скачать PDF
          </Button>
          {isContractRoute && (
            <Button
              variant="contained"
              color="primary"
              disabled={borrowerSigned && bankSigned}
              onClick={startSign}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              }}
            >
              {borrowerSigned && bankSigned ? 'Подписано' : 'Подписать (демо)'}
            </Button>
          )}
          {!isContractRoute && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => navigate('/app/documents')}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
            >
              ← К документам
            </Button>
          )}
        </Stack>
      </Stack>

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
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(260px, 0.75fr)' },
          alignItems: 'start',
        }}
      >
        {/* Document sheet */}
        <Box
          sx={{
            ...tileSx,
            position: 'relative',
            overflow: 'hidden',
            p: { xs: 2.5, md: 3.5 },
            minHeight: 520,
          }}
        >
          <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 2, fontWeight: 600 }}>
            Страница 1 из 4
          </Typography>

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 64, md: 96 },
                letterSpacing: '0.08em',
                color: 'rgba(239,49,36,0.07)',
                transform: 'rotate(-28deg)',
                userSelect: 'none',
              }}
            >
              ДЕМО
            </Typography>
          </Box>

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: 16, md: 18 },
                color: '#0B1F35',
                letterSpacing: '-0.02em',
                mb: 2.5,
                textAlign: 'center',
              }}
            >
              {isContractRoute
                ? `КРЕДИТНЫЙ ДОГОВОР № DEMO-${applicationId.replace('ABC-', '')}`
                : title.toUpperCase()}
            </Typography>

            {isContractRoute ? (
              <Stack spacing={1.75}>
                <Clause
                  n={1}
                  title="Предмет договора"
                  text={`Банк предоставляет заёмщику кредит в размере ${AMOUNT} на срок ${TERM} для пополнения оборотных средств.`}
                />
                <Clause
                  n={2}
                  title="Проценты"
                  text={`Процентная ставка — ${RATE} годовых. Начисление ежемесячно на остаток основного долга.`}
                />
                <Clause
                  n={3}
                  title="Обслуживание"
                  text="Стоимость обслуживания счёта — около 4 400 ₽ в месяц (демо-условие)."
                />
                <Clause
                  n={4}
                  title="Досрочное погашение"
                  text="Досрочное погашение допускается без штрафов и комиссий при уведомлении банка за 5 рабочих дней."
                />
                <Clause
                  n={5}
                  title="Ответственность"
                  text="При просрочке платежа начисляется неустойка в размере, установленном тарифами банка (демо)."
                />

                <Box
                  sx={{
                    mt: 1,
                    p: 1.75,
                    borderRadius: 2,
                    border: '1px solid rgba(11,31,53,0.1)',
                    bgcolor: 'rgba(11,31,53,0.02)',
                  }}
                >
                  <Typography
                    sx={{ fontSize: 13, fontWeight: 800, color: '#0B1F35', mb: 1.25 }}
                  >
                    Ключевые условия
                  </Typography>
                  <Box
                    component="table"
                    sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
                  >
                    <Box component="tbody">
                      {[
                        ['Сумма / срок', `${AMOUNT} / ${TERM}`],
                        ['Ставка / платёж', `${RATE} / ${PAYMENT}`],
                        ['Первый платёж', '28.11.2026'],
                      ].map(([k, v]) => (
                        <Box
                          component="tr"
                          key={k}
                          sx={{
                            '& td': {
                              py: 0.65,
                              borderBottom: '1px solid rgba(11,31,53,0.06)',
                            },
                          }}
                        >
                          <Box component="td" sx={{ color: '#7A8795', width: '45%' }}>
                            {k}
                          </Box>
                          <Box component="td" sx={{ fontWeight: 700, color: '#0B1F35' }}>
                            {v}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography sx={{ fontSize: 14, color: '#5A6B7D', lineHeight: 1.6 }}>
                  Демо-превью файла «{title}». В продакшене здесь будет встроенный просмотрщик PDF /
                  изображения.
                </Typography>
                <Box
                  sx={{
                    height: 280,
                    borderRadius: 2,
                    bgcolor: '#F7F8FA',
                    border: '1px dashed rgba(11,31,53,0.14)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#9AA5B1',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  Предпросмотр документа
                </Box>
              </Stack>
            )}
          </Box>
        </Box>

        {/* Right column */}
        <Stack spacing={2}>
          {isContractRoute && (
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
                Подписание
              </Typography>
              <Stack spacing={1.35}>
                <SignRow
                  done={conditionsAccepted}
                  title="Условия приняты"
                  hint="Заёмщик подтвердил оферту"
                />
                <SignRow
                  done={borrowerSigned}
                  title="Подпись заёмщика (ПЭП)"
                  hint="Код из SMS"
                />
                <SignRow
                  done={bankSigned}
                  title="Подпись банка"
                  hint="Автоматически после вашей"
                />
              </Stack>
            </Box>
          )}

          {isContractRoute && (
            <Box sx={tileSx}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0B1F35',
                  mb: 1.25,
                }}
              >
                Платежи (первые)
              </Typography>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <Box component="thead">
                  <Box component="tr">
                    {['Дата', 'Платёж', 'Остаток'].map((h) => (
                      <Box
                        component="th"
                        key={h}
                        sx={{
                          textAlign: 'left',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#9AA5B1',
                          pb: 0.85,
                          borderBottom: '1px solid rgba(11,31,53,0.08)',
                        }}
                      >
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {PAYMENTS.map((p) => (
                    <Box
                      component="tr"
                      key={p.date}
                      sx={{
                        '& td': {
                          py: 0.85,
                          fontSize: 12.5,
                          borderBottom: '1px solid rgba(11,31,53,0.05)',
                        },
                      }}
                    >
                      <Box component="td" sx={{ color: '#5A6B7D' }}>
                        {p.date}
                      </Box>
                      <Box component="td" sx={{ fontWeight: 700, color: '#0B1F35' }}>
                        {p.amount}
                      </Box>
                      <Box component="td" sx={{ color: '#7A8795' }}>
                        {p.rest}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {isContractRoute && (
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={agreed}
                    onChange={(_, v) => setAgreed(v)}
                    disabled={borrowerSigned}
                    sx={{ color: '#C5CCD3', '&.Mui-checked': { color: '#EF3124' } }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: '#0B1F35', lineHeight: 1.4 }}>
                    Я прочитал договор и согласен с условиями
                  </Typography>
                }
                sx={{ alignItems: 'flex-start', ml: 0, mb: 1.25 }}
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={borrowerSigned && bankSigned}
                onClick={startSign}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.2,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                {borrowerSigned && bankSigned ? 'Договор подписан' : 'Подписать (демо)'}
              </Button>
            </Box>
          )}

          {!isContractRoute && (
            <Box sx={tileSx}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#0B1F35', mb: 0.75 }}>
                О файле
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#7A8795', lineHeight: 1.45 }}>
                Документ доступен для просмотра и скачивания. Для кредитного договора откройте
                подписание из заявки с альтернативой банка.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                component={RouterLink}
                to={`/app/applications/${APP_ID}/contract`}
                sx={{
                  mt: 1.75,
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                }}
              >
                Открыть демо-договор
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      <Dialog
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 3,
            textAlign: 'center',
          },
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 20,
            color: '#0B1F35',
            mb: 0.75,
          }}
        >
          Код из SMS
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#7A8795', mb: 2, lineHeight: 1.45 }}>
          Демо: введите любые 4+ цифры, чтобы подписать ПЭП
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="••••"
          value={smsCode}
          onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputProps={{
            inputMode: 'numeric',
            style: {
              textAlign: 'center',
              letterSpacing: '0.35em',
              fontWeight: 800,
              fontSize: 20,
            },
          }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
          }}
        />
        <Stack direction="row" spacing={1.25}>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => setSmsOpen(false)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            Отмена
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            disabled={smsCode.length < 4}
            onClick={confirmSms}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 'none',
            }}
          >
            Подтвердить
          </Button>
        </Stack>
      </Dialog>
    </Box>
  )
}

function Clause({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0B1F35', mb: 0.4 }}>
        {n}. {title}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: '#5A6B7D', lineHeight: 1.55 }}>{text}</Typography>
    </Box>
  )
}

function SignRow({ done, title, hint }: { done: boolean; title: string; hint: string }) {
  return (
    <Stack direction="row" spacing={1.15} alignItems="flex-start">
      <StepIcon done={done} />
      <Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#0B1F35', lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.2 }}>{hint}</Typography>
      </Box>
    </Stack>
  )
}
