import { useParams } from 'react-router-dom'
import { Page } from '@/components/Page'
import {
  currentProfile,
  isGroupAdmin,
  removeMember,
  setMemberColor,
  setMemberRole,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { SESSION_COLORS, type GroupRole } from '@/types/domain'

export function GroupMembersPage() {
  const { groupId = '' } = useParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const group = state.groups.find((g) => g.id === groupId)
  const admin = isGroupAdmin(groupId, profile.id)
  const members = state.members.filter((m) => m.groupId === groupId)
  const usedColors = members.map((m) => m.color.toLowerCase())

  if (!group) {
    return (
      <Page title="Membros" backTo="/groups">
        <div className="empty">Grupo não encontrado</div>
      </Page>
    )
  }

  return (
    <Page kicker="membros" title="Membros" backTo={`/groups/${groupId}`} wide>
      <p className="muted">
        Código de convite:{' '}
        <strong style={{ letterSpacing: '0.06em', color: 'var(--ink)' }}>{group.inviteCode}</strong>
      </p>
      <p className="muted">Cada membro tem uma cor única neste grupo.</p>
      <div className="list">
        {members.map((m) => {
          const p = state.profiles.find((x) => x.id === m.userId)
          const canEditColor = admin || m.userId === profile.id
          return (
            <div key={m.id} className="list-item stack">
              <div className="row spread">
                <div className="row">
                  <span className="dot" style={{ background: m.color }} />
                  <div>
                    <div className="title">{p?.name}</div>
                    <p className="muted">{p?.email}</p>
                  </div>
                </div>
                <span className="badge">{m.role}</span>
              </div>
              {canEditColor && (
                <div className="field">
                  <label>Cor no grupo</label>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {SESSION_COLORS.map((c) => {
                      const taken =
                        usedColors.includes(c.toLowerCase()) &&
                        m.color.toLowerCase() !== c.toLowerCase()
                      return (
                        <button
                          key={c}
                          type="button"
                          className="btn icon"
                          disabled={taken}
                          style={{
                            background: c,
                            opacity: taken ? 0.25 : 1,
                            outline: m.color.toLowerCase() === c.toLowerCase()
                              ? '2px solid var(--ink)'
                              : 'none',
                            outlineOffset: 2,
                          }}
                          onClick={() => {
            void (async () => {
              try {
                await setMemberColor(m.id, c)
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Cor indisponível')
              }
            })()
                          }}
                          aria-label={`Cor ${c}`}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
              {admin && m.userId !== profile.id && (
                <div className="row">
                  <select
                    value={m.role}
                    onChange={(e) => void setMemberRole(m.id, e.target.value as GroupRole)}
                  >
                    <option value="admin">admin</option>
                    <option value="musician">musician</option>
                  </select>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => void removeMember(m.id)}
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Page>
  )
}
