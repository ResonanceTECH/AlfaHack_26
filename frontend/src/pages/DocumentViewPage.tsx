import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  loadTeamMembers,
  ROLE_LABEL,
  ROLE_RIGHTS_TEXT,
  type TeamMember,
} from '@/features/team/store'
import {
  addDocAssignment,
  loadDocAssignments,
  PURPOSE_LABEL,
  removeDocAssignment,
  STATUS_LABEL,
  type DocAssignment,
  type DocAssignPurpose,
} from '@/features/documents/assignments'

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

const FALLBACK_TEAM: TeamMember[] = [
  {
    id: 'm2',
    name: 'Лебедева Ирина Олеговна',
    email: 'buh@kofeplus.demo',
    role: 'accountant',
    rights: ROLE_RIGHTS_TEXT.accountant,
    lastLogin: 'вчера',
    status: 'active',
    statusLabel: 'Активна',
  },
  {
    id: 'm3',
    name: 'Громов Артём Викторович',
    email: 'gromov@kofeplus.demo',
    role: 'viewer',
    rights: ROLE_RIGHTS_TEXT.viewer,
    lastLogin: '—',
    status: 'active',
    statusLabel: 'Активен',
  },
  {
    id: 'm4',
    name: 'Игорь Петров',
    email: 'igor@coffeeplus.ru',
    role: 'accountant',
    rights: ROLE_RIGHTS_TEXT.accountant,
    lastLogin: 'вчера',
    status: 'active',
    statusLabel: 'Активен',
  },
]

export function DocumentViewPage() {
  const { user } = useAuth()
  const { docId, id: appId } = useParams<{ docId?: string; id?: string }>()
  const [params] = useSearchParams()

  const isContractRoute = Boolean(appId) || docId === 'contract' || params.get('type') === 'contract'
  const applicationId = appId || params.get('app') || APP_ID
  const title =
    isContractRoute
      ? 'Демонстрационный договор'
      : DOC_TITLES[docId ?? ''] || 'Просмотр документа'
  const docKey = isContractRoute ? `contract:${applicationId}` : `doc:${docId ?? 'unknown'}`

  const [agreed, setAgreed] = useState(true)
  const [borrowerSigned, setBorrowerSigned] = useState(false)
  const [bankSigned, setBankSigned] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsCode, setSmsCode] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const smsInputRef = useRef<HTMLInputElement | null>(null)

  const [assignments, setAssignments] = useState<DocAssignment[]>(() => loadDocAssignments(docKey))
  const [pickMemberId, setPickMemberId] = useState('')
  const [pickPurpose, setPickPurpose] = useState<DocAssignPurpose>('approve')

  const team = useMemo(() => {
    const seed: TeamMember = {
      id: user?.id || 'owner',
      name: user?.fullName || 'Владелец компании',
      email: user?.email || 'owner@company.demo',
      role: 'owner',
      rights: ROLE_RIGHTS_TEXT.owner,
      lastLogin: 'сегодня',
      status: 'active',
      statusLabel: 'Активен',
    }
    const loaded = loadTeamMembers(seed)
    const extras = FALLBACK_TEAM.filter(
      (f) => !loaded.some((m) => m.id === f.id || m.email === f.email),
    )
    return [...loaded, ...extras]
  }, [user])

  const assignable = useMemo(
    () => team.filter((m) => m.status === 'active' || m.status === 'invited'),
    [team],
  )

  useEffect(() => {
    setAssignments(loadDocAssignments(docKey))
    setPickMemberId('')
  }, [docKey])

  const conditionsAccepted = true
  const fullySigned = borrowerSigned && bankSigned
  const canSign = isContractRoute || Boolean(docId)

  function assignPerson() {
    const member = assignable.find((m) => m.id === pickMemberId)
    if (!member) return
    const item: DocAssignment = {
      memberId: member.id,
      name: member.name,
      email: member.email,
      roleLabel: ROLE_LABEL[member.role],
      purpose: pickPurpose,
      status: 'pending',
      assignedAt: new Date().toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
    setAssignments(addDocAssignment(docKey, item))
    setPickMemberId('')
    setFlash(`Назначено: ${member.name} · ${PURPOSE_LABEL[pickPurpose].toLowerCase()}`)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function unassign(memberId: string) {
    setAssignments(removeDocAssignment(docKey, memberId))
  }

  useEffect(() => {
    if (smsOpen) {
      window.setTimeout(() => smsInputRef.current?.focus(), 50)
    }
  }, [smsOpen])

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
    if (fullySigned) return
    setSmsCode('')
    setSmsSending(true)
    setSmsOpen(true)
    window.setTimeout(() => setSmsSending(false), 600)
  }

  function confirmSms() {
    if (smsCode.trim().length < 4) return
    const now = new Date()
    const stamp = now.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    setSmsOpen(false)
    setBorrowerSigned(true)
    setSignedAt(stamp)
    setFlash('ПЭП подтверждена · ждём подпись банка…')
    window.setTimeout(() => {
      setBankSigned(true)
      setFlash('Документ подписан простой электронной подписью')
      window.setTimeout(() => setFlash(null), 2800)
    }, 900)
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
            {canSign
              ? 'Проверьте документ и подпишите простой электронной подписью (демо)'
              : 'Просмотр загруженного файла · демо-превью'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<DownloadRoundedIcon />}
          onClick={downloadPdf}
          sx={{
            borderRadius: 999,
            fontWeight: 700,
            textTransform: 'none',
            alignSelf: 'flex-start',
            px: 2,
          }}
        >
          Скачать PDF
        </Button>
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

            {fullySigned && signedAt && (
              <Box
                sx={{
                  mt: 3,
                  ml: 'auto',
                  width: { xs: '100%', sm: 240 },
                  p: 1.5,
                  borderRadius: 2,
                  border: '2px solid rgba(27,138,90,0.55)',
                  bgcolor: 'rgba(230,245,238,0.65)',
                  transform: { sm: 'rotate(-3deg)' },
                }}
              >
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#1B8A5A',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    mb: 0.5,
                  }}
                >
                  Подписано ПЭП
                </Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#0B1F35' }}>
                  ООО «Кофе Плюс»
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#5A6B7D', mt: 0.25 }}>
                  {signedAt}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#9AA5B1', mt: 0.75, lineHeight: 1.35 }}>
                  Имитация простой электронной подписи · код SMS подтверждён
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right column */}
        <Stack spacing={2}>
          <Box sx={tileSx}>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: '#0B1F35',
                mb: 0.5,
              }}
            >
              Назначить на документ
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: '#7A8795', mb: 1.75, lineHeight: 1.4 }}>
              Выберите сотрудника для просмотра или согласования этого файла
            </Typography>

            <Stack spacing={1.25}>
              <TextField
                select
                size="small"
                label="Сотрудник"
                value={pickMemberId || '__none__'}
                onChange={(e) =>
                  setPickMemberId(e.target.value === '__none__' ? '' : e.target.value)
                }
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="__none__">Выберите из команды</MenuItem>
                {assignable.map((m) => (
                  <MenuItem
                    key={m.id}
                    value={m.id}
                    disabled={assignments.some((a) => a.memberId === m.id)}
                  >
                    {m.name} · {ROLE_LABEL[m.role]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Задача"
                value={pickPurpose}
                onChange={(e) => setPickPurpose(e.target.value as DocAssignPurpose)}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="approve">Согласование</MenuItem>
                <MenuItem value="view">Только просмотр</MenuItem>
              </TextField>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<PersonAddAlt1RoundedIcon />}
                disabled={!pickMemberId}
                onClick={assignPerson}
                sx={{
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                Назначить
              </Button>
            </Stack>

            {assignments.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9AA5B1' }}>
                  Назначены
                </Typography>
                {assignments.map((a) => (
                  <Box
                    key={a.memberId}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      border: '1px solid rgba(11,31,53,0.08)',
                      bgcolor: 'rgba(11,31,53,0.015)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          bgcolor: '#E8ECF0',
                          color: '#5A6B7D',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {a.name
                          .split(/\s+/)
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: '#0B1F35' }}>
                          {a.name}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 0.15 }}>
                          {a.roleLabel} · {PURPOSE_LABEL[a.purpose]}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.65 }}>
                          <Box
                            component="span"
                            sx={{
                              px: 0.75,
                              py: 0.2,
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              bgcolor:
                                a.status === 'approved'
                                  ? '#E6F5EE'
                                  : a.status === 'viewed'
                                    ? '#EEF1F4'
                                    : '#FFF0E0',
                              color:
                                a.status === 'approved'
                                  ? '#1B8A5A'
                                  : a.status === 'viewed'
                                    ? '#5A6B7D'
                                    : '#C45A12',
                            }}
                          >
                            {STATUS_LABEL[a.status]}
                          </Box>
                          <Typography sx={{ fontSize: 11, color: '#C5CCD3' }}>
                            {a.assignedAt}
                          </Typography>
                        </Stack>
                      </Box>
                      <Button
                        size="small"
                        onClick={() => unassign(a.memberId)}
                        sx={{
                          minWidth: 0,
                          px: 0.75,
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'none',
                          color: '#9AA5B1',
                          '&:hover': { color: '#C41E14' },
                        }}
                      >
                        Снять
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {assignable.length === 0 && (
              <Typography sx={{ fontSize: 13, color: '#9AA5B1', mt: 1.5, lineHeight: 1.4 }}>
                В команде пока никого нет.{' '}
                <Box
                  component={RouterLink}
                  to="/app/team/invite"
                  sx={{ color: '#EF3124', fontWeight: 700, textDecoration: 'none' }}
                >
                  Пригласить
                </Box>
              </Typography>
            )}
          </Box>

          {canSign && (
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
                  hint={isContractRoute ? 'Заёмщик подтвердил оферту' : 'Согласие с документом'}
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

          {canSign && (
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
                    {isContractRoute
                      ? 'Я прочитал договор и согласен с условиями'
                      : 'Я прочитал документ и согласен подписать'}
                  </Typography>
                }
                sx={{ alignItems: 'flex-start', ml: 0, mb: 1.25 }}
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={fullySigned || !agreed}
                onClick={startSign}
                sx={{
                  borderRadius: 999,
                  fontWeight: 700,
                  textTransform: 'none',
                  py: 1.25,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                {fullySigned ? 'Документ подписан' : 'Подписать (демо)'}
              </Button>
              {!fullySigned && (
                <Typography sx={{ fontSize: 12, color: '#9AA5B1', mt: 1, lineHeight: 1.4, textAlign: 'center' }}>
                  Имитация ПЭП: код придёт в SMS-окне
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </Box>

      <Dialog
        open={smsOpen}
        onClose={() => !smsSending && setSmsOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            px: { xs: 2.5, sm: 3.5 },
            py: { xs: 2.75, sm: 3.25 },
            textAlign: 'center',
            boxShadow: '0 16px 48px rgba(11,31,53,0.2)',
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
        <Typography sx={{ fontSize: 13.5, color: '#7A8795', mb: 0.75, lineHeight: 1.45 }}>
          {smsSending
            ? 'Отправляем код на +7 ··· ···· 42…'
            : 'Демо: введите любые 4+ цифры, чтобы подписать ПЭП'}
        </Typography>
        {!smsSending && (
          <Typography sx={{ fontSize: 12, color: '#9AA5B1', mb: 2 }}>
            Код отправлен · действует 5 минут
          </Typography>
        )}
        <TextField
          fullWidth
          size="small"
          placeholder="••••"
          value={smsCode}
          disabled={smsSending}
          inputRef={smsInputRef}
          onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && smsCode.length >= 4) confirmSms()
          }}
          inputProps={{
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            style: {
              textAlign: 'center',
              letterSpacing: '0.4em',
              fontWeight: 800,
              fontSize: 22,
            },
          }}
          sx={{
            mb: 2.25,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: '#fff',
            },
          }}
        />
        <Stack direction="row" spacing={1.25}>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => setSmsOpen(false)}
            sx={{ borderRadius: 999, fontWeight: 700, textTransform: 'none', py: 1.05 }}
          >
            Отмена
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            disabled={smsCode.length < 4 || smsSending}
            onClick={confirmSms}
            sx={{
              borderRadius: 999,
              fontWeight: 700,
              textTransform: 'none',
              py: 1.05,
              boxShadow: 'none',
              color: '#fff',
              '&:hover': { boxShadow: 'none' },
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
