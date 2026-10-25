import { Navigate } from 'react-router-dom'

/** Legacy path — кабинет аналитика на /app/analyst */
export function ManagerPage() {
  return <Navigate to="/app/analyst" replace />
}
