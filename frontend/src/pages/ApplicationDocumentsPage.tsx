import { Navigate, useParams } from 'react-router-dom'

/** Legacy URL → единая страница заявки с блоком документов */
export function ApplicationDocumentsPage() {
  const { id } = useParams()
  if (!id) return <Navigate to="/app/applications" replace />
  return <Navigate to={`/app/applications/${id}#documents`} replace />
}
