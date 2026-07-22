import type { AppState, GroupMember } from '@/types/domain'
import { pickUniqueGroupColor } from '@/lib/color'
import { createId, nowIso } from '@/lib/id'

const STORAGE_KEY = 'brain.app.v1'

export function emptyState(): AppState {
  return {
    accounts: [],
    profiles: [],
    groups: [],
    members: [],
    songs: [],
    participants: [],
    stanzas: [],
    slots: [],
    proposals: [],
    votes: [],
    audioTakes: [],
    sessions: [],
    currentUserId: null,
  }
}

function migrateMembers(members: GroupMember[]): GroupMember[] {
  const byGroup = new Map<string, GroupMember[]>()
  for (const m of members) {
    const list = byGroup.get(m.groupId) ?? []
    list.push(m)
    byGroup.set(m.groupId, list)
  }

  const migrated: GroupMember[] = []
  for (const [, groupMembers] of byGroup) {
    const used: string[] = []
    for (const m of groupMembers) {
      let color = m.color
      if (!color || used.map((c) => c.toLowerCase()).includes(color.toLowerCase())) {
        color = pickUniqueGroupColor(used)
      }
      used.push(color)
      migrated.push({ ...m, color })
    }
  }
  return migrated
}

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback
}

export function normalizeState(raw: Partial<AppState> | null | undefined): AppState {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  const profiles = asArray(raw.profiles, base.profiles).map((p) => {
    const { preferredColor: _removed, ...rest } = p as typeof p & { preferredColor?: string }
    void _removed
    return rest
  })

  return {
    ...base,
    accounts: asArray(raw.accounts, base.accounts),
    profiles,
    groups: asArray(raw.groups, base.groups),
    members: migrateMembers(asArray(raw.members, base.members)),
    songs: asArray(raw.songs, base.songs),
    participants: asArray(raw.participants, base.participants),
    stanzas: asArray(raw.stanzas, base.stanzas),
    slots: asArray(raw.slots, base.slots),
    proposals: asArray(raw.proposals, base.proposals),
    votes: asArray(raw.votes, base.votes),
    audioTakes: asArray(raw.audioTakes, base.audioTakes),
    sessions: asArray(raw.sessions, base.sessions),
    currentUserId:
      typeof raw.currentUserId === 'string' || raw.currentUserId === null
        ? raw.currentUserId
        : null,
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return normalizeState(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Não foi possível salvar o estado local (quota ou modo privado).', err)
  }
}

export function makeInviteCode(): string {
  return createId('inv').slice(-8).toUpperCase()
}

export { createId, nowIso }
