import { Navigate, useParams } from 'react-router-dom'

/** Legacy route — member management lives on the group detail tab. */
export function GroupMembersPage() {
  const { groupId = '' } = useParams()
  return <Navigate to={`/groups/${groupId}?tab=members`} replace />
}
