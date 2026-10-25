import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'

const titles: Record<string, string> = {
  '/app/admin/analytics': 'Аналитика',
  '/app/admin/products': 'Кредитные продукты',
  '/app/admin/policy': 'Кредитная политика',
  '/app/admin/rules': 'Тестирование правил',
  '/app/admin/models': 'AI/ML модели',
  '/app/admin/model-quality': 'Качество моделей',
  '/app/admin/users': 'Пользователи и роли',
  '/app/admin/demo-data': 'Демо-данные',
  '/app/admin/audit': 'Аудит изменений',
  '/app/admin/status': 'Статус системы',
}

export function AdminStubPage() {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Раздел'

  return (
    <Box>
      <PageHeader title={title} subtitle="Раздел админ-консоли · в разработке для демо" />
      <EmptyState
        title="Скоро здесь будет рабочий экран"
        description="Пока доступен обзор системы с KPI, воронкой и алертами."
        actionLabel="К обзору системы"
        actionTo="/app/admin"
      />
    </Box>
  )
}
