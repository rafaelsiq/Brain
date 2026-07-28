import { buildColoredSegments } from '@/lib/diff'
import { pickUniqueGroupColor } from '@/lib/color'
import {
  createId,
  emptyState,
  loadState,
  makeInviteCode,
  nowIso,
  saveState,
  normalizeState,
} from '@/data/persist'
import {
  fbAcceptProposal,
  fbAddSongParticipant,
  fbAddStanza,
  fbAppendVerse,
  fbCastVote,
  fbChangePassword,
  fbCreateGroup,
  fbCreateSong,
  fbDeleteAccount,
  fbDeleteGroup,
  fbDeleteSong,
  fbDeleteStanza,
  fbJoinGroupByCode,
  fbJoinSongSession,
  fbLoadUserUniverse,
  fbLogin,
  fbLogout,
  fbProposeVerse,
  fbRequestPasswordReset,
  fbRegister,
  fbRemoveMember,
  fbRemoveSongParticipant,
  fbRemoveVote,
  fbSaveAudioTake,
  fbSetMemberColor,
  fbSetMemberRole,
  fbStartNextStanza,
  fbUpdateGroup,
  fbUpdateProfile,
  fbUpdateSong,
  fbUpdateStanza,
  fbUploadAvatar,
  usingFirebase,
} from '@/data/firebaseRepo'
import type {
  AppState,
  AudioTake,
  Group,
  GroupMember,
  GroupRole,
  LineSlot,
  Profile,
  Song,
  SongParticipant,
  SongVisibility,
  Stanza,
  TextSegment,
  VerseProposal,
  VoteKind,
} from '@/types/domain'

type Listener = () => void

type HotData = { brainState?: AppState }

const hot = import.meta.hot
const hotData = (hot?.data ?? {}) as HotData

let state: AppState = hotData.brainState ?? (usingFirebase ? emptyState() : loadState())
const listeners = new Set<Listener>()

if (hot) {
  hot.accept()
  hot.dispose(() => {
    hot.data.brainState = state
  })
}

function emit() {
  if (!usingFirebase) saveState(state)
  listeners.forEach((l) => l())
}

function setState(partial: Partial<AppState> | ((s: AppState) => AppState)) {
  state = typeof partial === 'function' ? partial(state) : { ...state, ...partial }
  emit()
}

export function applyRemoteState(next: AppState): void {
  state = normalizeState(next)
  emit()
}

export function setCurrentUserId(userId: string | null): void {
  setState({ currentUserId: userId })
}

/** Load groups/songs/etc. from Firestore into the local cache. */
let hydrateInFlight: { userId: string; promise: Promise<void> } | null = null

export async function hydrateFirebaseUser(userId: string): Promise<void> {
  if (hydrateInFlight?.userId === userId) return hydrateInFlight.promise

  const promise = (async () => {
    const universe = await fbLoadUserUniverse(userId)
    applyRemoteState(normalizeState({ ...emptyState(), ...universe, currentUserId: userId }))
  })().finally(() => {
    if (hydrateInFlight?.promise === promise) hydrateInFlight = null
  })

  hydrateInFlight = { userId, promise }
  return promise
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): AppState {
  return state
}

export function useStoreSnapshot(): AppState {
  return state
}

/** Merge live song collections from Firestore into local cache. */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of items) map.set(item.id, item)
  return [...map.values()]
}

function slotSongId(slot: LineSlot, stanzas: Stanza[]): string | null {
  const tagged = (slot as LineSlot & { songId?: string }).songId
  if (tagged) return tagged
  return stanzas.find((s) => s.id === slot.stanzaId)?.songId ?? null
}

function proposalSongId(
  proposal: VerseProposal,
  slots: LineSlot[],
  stanzas: Stanza[],
): string | null {
  const tagged = (proposal as VerseProposal & { songId?: string }).songId
  if (tagged) return tagged
  const slot = slots.find((s) => s.id === proposal.slotId)
  return slot ? slotSongId(slot, stanzas) : null
}

export function mergeSongRemote(songId: string, partial: Partial<AppState>): void {
  const remoteStanzas = partial.stanzas ?? []
  const remoteSlots = partial.slots ?? []
  const remoteProposals = partial.proposals ?? []
  const remoteVotes = partial.votes ?? []
  const remoteSessions = partial.sessions ?? []
  const remoteAudio = partial.audioTakes ?? []
  const remoteParticipants = partial.participants

  const stanzasForLookup = [
    ...state.stanzas.filter((s) => s.songId !== songId),
    ...remoteStanzas,
  ]
  const slotsForLookup = [
    ...state.slots.filter((sl) => slotSongId(sl, state.stanzas) !== songId),
    ...remoteSlots,
  ]

  setState({
    stanzas: dedupeById([
      ...state.stanzas.filter((s) => s.songId !== songId),
      ...remoteStanzas,
    ]),
    slots: dedupeById([
      ...state.slots.filter((sl) => slotSongId(sl, state.stanzas) !== songId),
      ...remoteSlots,
    ]),
    proposals: dedupeById([
      ...state.proposals.filter(
        (p) => proposalSongId(p, state.slots, state.stanzas) !== songId,
      ),
      ...remoteProposals,
    ]),
    votes: dedupeById([
      ...state.votes.filter((v) => {
        const tagged = (v as { songId?: string }).songId
        if (tagged) return tagged !== songId
        const proposal = [...state.proposals, ...remoteProposals].find(
          (p) => p.id === v.proposalId,
        )
        return proposal
          ? proposalSongId(proposal, slotsForLookup, stanzasForLookup) !== songId
          : true
      }),
      ...remoteVotes,
    ]),
    sessions: [
      ...state.sessions.filter((s) => s.songId !== songId),
      ...remoteSessions,
    ],
    audioTakes: dedupeById([
      ...state.audioTakes.filter((a) => {
        const tagged = (a as { songId?: string }).songId
        if (tagged) return tagged !== songId
        const stanza = state.stanzas.find((s) => s.id === a.stanzaId)
        return stanza?.songId !== songId
      }),
      ...remoteAudio,
    ]),
    ...(remoteParticipants
      ? {
          participants: dedupeById([
            ...state.participants.filter((p) => p.songId !== songId),
            ...remoteParticipants,
          ]),
        }
      : {}),
  })
}

// ——— Auth / Profile ———

export async function register(input: {
  name: string
  email: string
  password: string
}): Promise<Profile> {
  if (usingFirebase) {
    const profile = await fbRegister(input)
    await hydrateFirebaseUser(profile.id)
    return profile
  }

  const email = input.email.trim().toLowerCase()
  if (state.accounts.some((a) => a.email === email)) {
    throw new Error('E-mail já cadastrado')
  }
  const profileId = createId('usr')
  const profile: Profile = {
    id: profileId,
    email,
    name: input.name.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  setState({
    profiles: [...state.profiles, profile],
    accounts: [
      ...state.accounts,
      { id: createId('acc'), email, password: input.password, profileId },
    ],
    currentUserId: profileId,
  })
  return profile
}

export async function login(email: string, password: string): Promise<Profile> {
  if (usingFirebase) {
    const profile = await fbLogin(email, password)
    await hydrateFirebaseUser(profile.id)
    return profile
  }

  const acc = state.accounts.find(
    (a) => a.email === email.trim().toLowerCase() && a.password === password,
  )
  if (!acc) throw new Error('Credenciais inválidas')
  const profile = state.profiles.find((p) => p.id === acc.profileId)
  if (!profile) throw new Error('Perfil não encontrado')
  setState({ currentUserId: profile.id })
  return profile
}

export async function logout(): Promise<void> {
  if (usingFirebase) {
    await fbLogout()
    applyRemoteState({ ...emptyState(), currentUserId: null })
    return
  }
  setState({ currentUserId: null })
}

export async function requestPasswordReset(input: { email: string }): Promise<void> {
  const email = input.email.trim().toLowerCase()
  if (!email) throw new Error('Informe um e-mail válido')

  if (usingFirebase) {
    await fbRequestPasswordReset(email)
    return
  }

  throw new Error(
    'Recuperação de senha segura requer backend de autenticação (Firebase Auth) configurado.',
  )
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'name' | 'avatarUrl'>>,
): Promise<Profile> {
  if (usingFirebase) {
    const updated = await fbUpdateProfile(userId, patch)
    setState({
      profiles: state.profiles.map((p) => (p.id === userId ? updated : p)),
    })
    return updated
  }
  const profiles = state.profiles.map((p) =>
    p.id === userId ? { ...p, ...patch, updatedAt: nowIso() } : p,
  )
  setState({ profiles })
  const updated = profiles.find((p) => p.id === userId)
  if (!updated) throw new Error('Perfil não encontrado')
  return updated
}

export async function uploadAvatar(userId: string, dataUrl: string): Promise<Profile> {
  if (usingFirebase) {
    const updated = await fbUploadAvatar(userId, dataUrl)
    setState({
      profiles: state.profiles.map((p) => (p.id === userId ? updated : p)),
    })
    return updated
  }
  return updateProfile(userId, { avatarUrl: dataUrl })
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (usingFirebase) {
    await fbChangePassword(currentPassword, newPassword)
    return
  }
  const userId = state.currentUserId
  if (!userId) throw new Error('Sessão inválida')
  const acc = state.accounts.find((a) => a.profileId === userId)
  if (!acc || acc.password !== currentPassword) {
    throw new Error('Senha atual incorreta')
  }
  if (newPassword.length < 6) {
    throw new Error('A nova senha deve ter pelo menos 6 caracteres')
  }
  setState({
    accounts: state.accounts.map((a) =>
      a.profileId === userId ? { ...a, password: newPassword } : a,
    ),
  })
}

function wipeLocalAccount(userId: string): void {
  setState({
    ...emptyState(),
    accounts: state.accounts.filter((a) => a.profileId !== userId),
    profiles: state.profiles.filter((p) => p.id !== userId),
    members: state.members.filter((m) => m.userId !== userId),
    participants: state.participants.filter((p) => p.userId !== userId),
    proposals: state.proposals.filter((p) => p.authorId !== userId),
    votes: state.votes.filter((v) => v.userId !== userId),
    audioTakes: state.audioTakes.filter((a) => a.userId !== userId),
    sessions: state.sessions.filter((s) => s.userId !== userId),
    currentUserId: state.currentUserId === userId ? null : state.currentUserId,
    groups: state.groups,
    songs: state.songs,
    stanzas: state.stanzas,
    slots: state.slots,
  })
}

export async function deleteAccount(userId: string, password: string): Promise<void> {
  if (usingFirebase) {
    await fbDeleteAccount(userId, password)
    applyRemoteState({ ...emptyState(), currentUserId: null })
    return
  }
  const acc = state.accounts.find((a) => a.profileId === userId)
  if (!acc || acc.password !== password) {
    throw new Error('Senha incorreta')
  }
  wipeLocalAccount(userId)
}

export function currentProfile(): Profile | null {
  if (!state.currentUserId) return null
  return state.profiles.find((p) => p.id === state.currentUserId) ?? null
}

export function profileActivityStats(userId: string): {
  groups: number
  songs: number
  takes: number
} {
  const groups = groupsForUser(userId).length
  const songIds = new Set(
    state.participants.filter((p) => p.userId === userId).map((p) => p.songId),
  )
  const songs = state.songs.filter(
    (s) => s.createdBy === userId || songIds.has(s.id),
  ).length
  const takes = state.audioTakes.filter((a) => a.userId === userId).length
  return { groups, songs, takes }
}

// ——— Groups ———

export async function createGroup(input: {
  name: string
  description: string
  createdBy: string
}): Promise<Group> {
  if (usingFirebase) {
    const { group, member } = await fbCreateGroup(input)
    setState({
      groups: [...state.groups, group],
      members: [...state.members, member],
    })
    return group
  }

  const group: Group = {
    id: createId('grp'),
    name: input.name.trim(),
    description: input.description.trim(),
    inviteCode: makeInviteCode(),
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  setState({
    groups: [...state.groups, group],
    members: [
      ...state.members,
      {
        id: createId('mem'),
        groupId: group.id,
        userId: input.createdBy,
        role: 'admin',
        color: pickUniqueGroupColor([]),
        joinedAt: nowIso(),
      },
    ],
  })
  return group
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'description' | 'coverUrl'>>,
): Promise<Group> {
  if (usingFirebase) await fbUpdateGroup(groupId, patch)
  const groups = state.groups.map((g) =>
    g.id === groupId ? { ...g, ...patch, updatedAt: nowIso() } : g,
  )
  setState({ groups })
  const g = groups.find((x) => x.id === groupId)
  if (!g) throw new Error('Grupo não encontrado')
  return g
}

export async function deleteGroup(groupId: string, actorId: string): Promise<void> {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) throw new Error('Grupo não encontrado')
  if (group.createdBy !== actorId) {
    throw new Error('Só o criador pode excluir o grupo')
  }
  if (usingFirebase) await fbDeleteGroup(groupId)
  const songIds = state.songs.filter((s) => s.groupId === groupId).map((s) => s.id)
  const stanzaIds = state.stanzas.filter((s) => songIds.includes(s.songId)).map((s) => s.id)
  const slotIds = state.slots.filter((s) => stanzaIds.includes(s.stanzaId)).map((s) => s.id)
  setState({
    groups: state.groups.filter((g) => g.id !== groupId),
    members: state.members.filter((m) => m.groupId !== groupId),
    songs: state.songs.filter((s) => s.groupId !== groupId),
    participants: state.participants.filter((p) => !songIds.includes(p.songId)),
    stanzas: state.stanzas.filter((s) => !songIds.includes(s.songId)),
    slots: state.slots.filter((s) => !stanzaIds.includes(s.stanzaId)),
    proposals: state.proposals.filter((p) => !slotIds.includes(p.slotId)),
    votes: state.votes.filter(
      (v) => !state.proposals.some((p) => p.id === v.proposalId && slotIds.includes(p.slotId)),
    ),
    audioTakes: state.audioTakes.filter((a) => !stanzaIds.includes(a.stanzaId)),
    sessions: state.sessions.filter((s) => !songIds.includes(s.songId)),
  })
}

export async function joinGroupByCode(inviteCode: string, userId: string): Promise<Group> {
  if (usingFirebase) {
    const { group, member } = await fbJoinGroupByCode(inviteCode, userId)
    setState({
      groups: [...state.groups.filter((g) => g.id !== group.id), group],
      members: [...state.members.filter((m) => m.id !== member.id), member],
    })
    return group
  }

  const group = state.groups.find(
    (g) => g.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase(),
  )
  if (!group) throw new Error('Código de convite inválido')
  if (state.members.some((m) => m.groupId === group.id && m.userId === userId)) {
    return group
  }
  const used = state.members.filter((m) => m.groupId === group.id).map((m) => m.color)
  setState({
    members: [
      ...state.members,
      {
        id: createId('mem'),
        groupId: group.id,
        userId,
        role: 'musician',
        color: pickUniqueGroupColor(used),
        joinedAt: nowIso(),
      },
    ],
  })
  return group
}

function assertNotGroupCreator(memberId: string, action: string): GroupMember {
  const member = state.members.find((m) => m.id === memberId)
  if (!member) throw new Error('Membro não encontrado')
  const group = state.groups.find((g) => g.id === member.groupId)
  if (!group) throw new Error('Grupo não encontrado')
  if (group.createdBy === member.userId) {
    throw new Error(`Não é possível ${action} o criador do grupo`)
  }
  return member
}

export async function setMemberRole(memberId: string, role: GroupRole): Promise<void> {
  assertNotGroupCreator(memberId, 'alterar o papel de')
  if (usingFirebase) await fbSetMemberRole(memberId, role)
  setState({
    members: state.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
  })
}

export async function removeMember(memberId: string): Promise<void> {
  assertNotGroupCreator(memberId, 'remover')
  if (usingFirebase) await fbRemoveMember(memberId)
  setState({ members: state.members.filter((m) => m.id !== memberId) })
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const group = state.groups.find((g) => g.id === groupId)
  if (!group) throw new Error('Grupo não encontrado')
  if (group.createdBy === userId) {
    throw new Error('O criador não pode sair do grupo. Exclua o grupo se quiser encerrá-lo.')
  }
  const member = state.members.find((m) => m.groupId === groupId && m.userId === userId)
  if (!member) throw new Error('Você não é membro deste grupo')
  if (usingFirebase) await fbRemoveMember(member.id)
  setState({ members: state.members.filter((m) => m.id !== member.id) })
}

export function groupsForUser(userId: string): Group[] {
  const ids = new Set(state.members.filter((m) => m.userId === userId).map((m) => m.groupId))
  return state.groups.filter((g) => ids.has(g.id))
}

export function isGroupCreator(groupId: string, userId: string): boolean {
  return state.groups.some((g) => g.id === groupId && g.createdBy === userId)
}

export function isGroupAdmin(groupId: string, userId: string): boolean {
  return state.members.some(
    (m) => m.groupId === groupId && m.userId === userId && m.role === 'admin',
  )
}

export function isGroupMember(groupId: string, userId: string): boolean {
  return state.members.some((m) => m.groupId === groupId && m.userId === userId)
}

export function getMemberColor(groupId: string, userId: string): string | null {
  return state.members.find((m) => m.groupId === groupId && m.userId === userId)?.color ?? null
}

export async function setMemberColor(memberId: string, color: string): Promise<void> {
  const member = state.members.find((m) => m.id === memberId)
  if (!member) throw new Error('Membro não encontrado')
  const clash = state.members.some(
    (m) =>
      m.groupId === member.groupId &&
      m.id !== memberId &&
      m.color.toLowerCase() === color.toLowerCase(),
  )
  if (clash) throw new Error('Cor já usada neste grupo')
  if (usingFirebase) await fbSetMemberColor(memberId, color)
  setState({
    members: state.members.map((m) => (m.id === memberId ? { ...m, color } : m)),
  })
}

// ——— Songs ———

export async function createSong(input: {
  groupId: string
  title: string
  visibility: SongVisibility
  createdBy: string
  key?: string
  bpm?: number
  stanzaCount?: number
  linesPerStanza?: number
  participantIds?: string[]
}): Promise<Song> {
  if (usingFirebase) {
    const created = await fbCreateSong(input)
    setState({
      songs: [...state.songs, created.song],
      stanzas: [...state.stanzas, ...created.stanzas],
      slots: [...state.slots, ...created.slots],
      participants: [...state.participants, ...created.participants],
    })
    return created.song
  }

  const song: Song = {
    id: createId('sng'),
    groupId: input.groupId,
    title: input.title.trim(),
    visibility: input.visibility,
    key: input.key,
    bpm: input.bpm,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const stanzaCount = input.stanzaCount ?? 0
  const linesPerStanza = input.linesPerStanza ?? 0
  const stanzas: Stanza[] = []
  const slots: LineSlot[] = []

  for (let i = 0; i < stanzaCount; i++) {
    const stanza: Stanza = {
      id: createId('stz'),
      songId: song.id,
      index: i,
      createdAt: nowIso(),
    }
    stanzas.push(stanza)
    for (let j = 0; j < linesPerStanza; j++) {
      slots.push({
        id: createId('slt'),
        stanzaId: stanza.id,
        index: j,
      })
    }
  }

  const participants =
    input.visibility === 'private'
      ? Array.from(new Set([input.createdBy, ...(input.participantIds ?? [])])).map((userId) => ({
          id: `${song.id}_${userId}`,
          songId: song.id,
          userId,
        }))
      : []

  setState({
    songs: [...state.songs, song],
    stanzas: [...state.stanzas, ...stanzas],
    slots: [...state.slots, ...slots],
    participants: [...state.participants, ...participants],
  })
  return song
}

export async function updateSong(
  songId: string,
  patch: Partial<Pick<Song, 'title' | 'visibility' | 'key' | 'bpm'>>,
): Promise<Song> {
  const current = state.songs.find((s) => s.id === songId)
  if (!current) throw new Error('Música não encontrada')

  if (usingFirebase) await fbUpdateSong(songId, patch)
  const songs = state.songs.map((s) =>
    s.id === songId ? { ...s, ...patch, updatedAt: nowIso() } : s,
  )
  let participants = state.participants
  const nextVisibility = patch.visibility ?? current.visibility
  if (nextVisibility === 'private') {
    const hasCreator = participants.some(
      (p) => p.songId === songId && p.userId === current.createdBy,
    )
    if (!hasCreator) {
      const creatorPart: SongParticipant = {
        id: `${songId}_${current.createdBy}`,
        songId,
        userId: current.createdBy,
      }
      if (usingFirebase) await fbAddSongParticipant(songId, current.createdBy)
      participants = [...participants, creatorPart]
    }
  }
  setState({ songs, participants })
  const song = songs.find((s) => s.id === songId)
  if (!song) throw new Error('Música não encontrada')
  return song
}

export async function addSongParticipant(songId: string, userId: string): Promise<SongParticipant> {
  const song = state.songs.find((s) => s.id === songId)
  if (!song) throw new Error('Música não encontrada')
  if (song.visibility !== 'private') {
    throw new Error('Só músicas privadas têm lista de participantes')
  }
  if (!isGroupMember(song.groupId, userId)) {
    throw new Error('A pessoa precisa ser membro do grupo')
  }
  if (state.participants.some((p) => p.songId === songId && p.userId === userId)) {
    const existing = state.participants.find((p) => p.songId === songId && p.userId === userId)!
    return existing
  }
  const participant = usingFirebase
    ? await fbAddSongParticipant(songId, userId)
    : { id: `${songId}_${userId}`, songId, userId }
  setState({ participants: [...state.participants, participant] })
  return participant
}

export async function removeSongParticipant(songId: string, userId: string): Promise<void> {
  const song = state.songs.find((s) => s.id === songId)
  if (!song) throw new Error('Música não encontrada')
  if (song.createdBy === userId) {
    throw new Error('Não é possível remover o criador da música')
  }
  const participant = state.participants.find((p) => p.songId === songId && p.userId === userId)
  if (!participant) return
  if (usingFirebase) await fbRemoveSongParticipant(participant.id)
  setState({ participants: state.participants.filter((p) => p.id !== participant.id) })
}

export async function deleteSong(songId: string): Promise<void> {
  if (usingFirebase) await fbDeleteSong(songId)
  const stanzaIds = state.stanzas.filter((s) => s.songId === songId).map((s) => s.id)
  const slotIds = state.slots.filter((s) => stanzaIds.includes(s.stanzaId)).map((s) => s.id)
  const proposalIds = state.proposals.filter((p) => slotIds.includes(p.slotId)).map((p) => p.id)
  setState({
    songs: state.songs.filter((s) => s.id !== songId),
    participants: state.participants.filter((p) => p.songId !== songId),
    stanzas: state.stanzas.filter((s) => s.songId !== songId),
    slots: state.slots.filter((s) => !stanzaIds.includes(s.stanzaId)),
    proposals: state.proposals.filter((p) => !slotIds.includes(p.slotId)),
    votes: state.votes.filter((v) => !proposalIds.includes(v.proposalId)),
    audioTakes: state.audioTakes.filter((a) => !stanzaIds.includes(a.stanzaId)),
    sessions: state.sessions.filter((s) => s.songId !== songId),
  })
}

export function canAccessSong(songId: string, userId: string): boolean {
  const song = state.songs.find((s) => s.id === songId)
  if (!song) return false
  if (!isGroupMember(song.groupId, userId)) return false
  if (song.visibility === 'public_in_group') return true
  if (song.createdBy === userId) return true
  return state.participants.some((p) => p.songId === songId && p.userId === userId)
}

export function songsForGroup(groupId: string, userId: string): Song[] {
  return state.songs
    .filter((s) => s.groupId === groupId)
    .filter((s) => canAccessSong(s.id, userId))
}

export async function addStanza(songId: string, lines = 4): Promise<Stanza> {
  const existing = state.stanzas.filter((s) => s.songId === songId)
  if (usingFirebase) {
    const created = await fbAddStanza(songId, existing.length, lines)
    setState({
      stanzas: [...state.stanzas, created.stanza],
      slots: [...state.slots, ...created.slots],
    })
    return created.stanza
  }
  const stanza: Stanza = {
    id: createId('stz'),
    songId,
    index: existing.length,
    createdAt: nowIso(),
  }
  const slots = Array.from({ length: lines }, (_, j) => ({
    id: createId('slt'),
    stanzaId: stanza.id,
    index: j,
  }))
  setState({
    stanzas: [...state.stanzas, stanza],
    slots: [...state.slots, ...slots],
  })
  return stanza
}

export async function updateStanzaTitle(stanzaId: string, title: string): Promise<Stanza> {
  const trimmed = title.trim()
  if (usingFirebase) await fbUpdateStanza(stanzaId, { title: trimmed || undefined })
  const stanzas = state.stanzas.map((s) => {
    if (s.id !== stanzaId) return s
    if (trimmed) return { ...s, title: trimmed }
    const { title: _removed, ...rest } = s
    return rest
  })
  setState({ stanzas })
  const stanza = stanzas.find((s) => s.id === stanzaId)
  if (!stanza) throw new Error('Estrofe não encontrada')
  return stanza
}

/** Propose a verse on the open slot (no auto-accept). Creates stanza/slot if needed. */
export async function appendVerse(input: {
  songId: string
  authorId: string
  text: string
  sessionColor: string
  /** Target stanza; defaults to the last stanza of the song. */
  stanzaId?: string
}): Promise<VerseProposal> {
  const text = input.text.trim()
  if (!text) throw new Error('Verso vazio')

  const songStanzas = state.stanzas
    .filter((s) => s.songId === input.songId)
    .sort((a, b) => a.index - b.index)
  let openStanza = input.stanzaId
    ? songStanzas.find((s) => s.id === input.stanzaId)
    : songStanzas[songStanzas.length - 1]
  if (input.stanzaId && !openStanza) {
    throw new Error('Estrofe não encontrada')
  }

  const slotsInStanza = openStanza
    ? state.slots
        .filter((s) => s.stanzaId === openStanza!.id)
        .sort((a, b) => a.index - b.index)
    : []
  const lastSlot = slotsInStanza[slotsInStanza.length - 1]
  // Open slot = last slot without a definitive; otherwise create the next one
  const openSlot =
    lastSlot && !lastSlot.acceptedProposalId ? lastSlot : undefined
  const slotIndex = openSlot ? openSlot.index : slotsInStanza.length

  if (usingFirebase) {
    const created = await fbAppendVerse({
      songId: input.songId,
      stanza: openStanza,
      createStanzaIndex: openStanza ? undefined : 0,
      slot: openSlot,
      slotIndex,
      authorId: input.authorId,
      text,
      sessionColor: input.sessionColor,
    })
    setState({
      stanzas: created.stanzaCreated
        ? dedupeById([...state.stanzas, created.stanza])
        : state.stanzas,
      slots: created.slotCreated
        ? dedupeById([...state.slots, created.slot])
        : state.slots,
      proposals: dedupeById([...state.proposals, created.proposal]),
    })
    return created.proposal
  }

  if (!openStanza) {
    openStanza = {
      id: createId('stz'),
      songId: input.songId,
      index: 0,
      createdAt: nowIso(),
    }
    setState({ stanzas: [...state.stanzas, openStanza] })
  }

  let slot = openSlot
  if (!slot) {
    slot = {
      id: createId('slt'),
      stanzaId: openStanza.id,
      index: slotIndex,
    }
    setState({ slots: [...state.slots, slot] })
  }

  const proposal: VerseProposal = {
    id: createId('prp'),
    slotId: slot.id,
    authorId: input.authorId,
    text,
    segments: buildColoredSegments(text, input.authorId, input.sessionColor),
    createdAt: nowIso(),
  }
  setState({
    proposals: [...state.proposals, proposal],
  })
  return proposal
}

/** Close current open stanza and start a new empty one. */
export async function startNextStanza(songId: string): Promise<Stanza> {
  const songStanzas = state.stanzas
    .filter((s) => s.songId === songId)
    .sort((a, b) => a.index - b.index)
  const open = songStanzas[songStanzas.length - 1]
  if (!open) throw new Error('Escreva ao menos um verso antes de criar outra estrofe')

  const openSlots = state.slots.filter((s) => s.stanzaId === open.id)
  const hasAccepted = openSlots.some((s) => Boolean(s.acceptedProposalId))
  if (!hasAccepted) {
    throw new Error('A estrofe atual precisa ter pelo menos um verso definitivo')
  }

  const nextIndex = open.index + 1
  if (usingFirebase) {
    const stanza = await fbStartNextStanza(songId, nextIndex)
    setState({ stanzas: [...state.stanzas, stanza] })
    return stanza
  }
  return addStanza(songId, 0)
}

export async function deleteStanza(stanzaId: string): Promise<void> {
  const stanza = state.stanzas.find((s) => s.id === stanzaId)
  if (!stanza) throw new Error('Estrofe não encontrada')

  const songStanzas = state.stanzas.filter((s) => s.songId === stanza.songId)
  if (songStanzas.length <= 1) {
    const onlySlots = state.slots.filter((s) => s.stanzaId === stanzaId)
    const hasContent = onlySlots.some((s) => Boolean(s.acceptedProposalId))
    if (hasContent) {
      throw new Error('A música precisa ter pelo menos uma estrofe')
    }
  }

  const slotIds = state.slots.filter((s) => s.stanzaId === stanzaId).map((s) => s.id)
  const proposalIds = state.proposals.filter((p) => slotIds.includes(p.slotId)).map((p) => p.id)

  const remaining = state.stanzas
    .filter((s) => s.id !== stanzaId)
    .map((s) =>
      s.songId === stanza.songId && s.index > stanza.index
        ? { ...s, index: s.index - 1 }
        : s,
    )

  if (usingFirebase) await fbDeleteStanza(stanza, remaining)

  setState({
    stanzas: remaining,
    slots: state.slots.filter((s) => s.stanzaId !== stanzaId),
    proposals: state.proposals.filter((p) => !slotIds.includes(p.slotId)),
    votes: state.votes.filter((v) => !proposalIds.includes(v.proposalId)),
    audioTakes: state.audioTakes.filter((a) => a.stanzaId !== stanzaId),
  })
}

// ——— Editor / proposals ———

export async function joinSongSession(songId: string, userId: string): Promise<string> {
  const song = state.songs.find((s) => s.id === songId)
  if (!song) throw new Error('Música não encontrada')

  let member = state.members.find((m) => m.groupId === song.groupId && m.userId === userId)
  if (!member) throw new Error('Usuário não é membro do grupo')

  if (!member.color) {
    const used = state.members
      .filter((m) => m.groupId === song.groupId && m.id !== member!.id)
      .map((m) => m.color)
      .filter(Boolean)
    const color = pickUniqueGroupColor(used)
    if (usingFirebase) await fbSetMemberColor(member.id, color)
    setState({
      members: state.members.map((m) => (m.id === member!.id ? { ...m, color } : m)),
    })
    member = { ...member, color }
  }

  const color = member.color
  if (usingFirebase) await fbJoinSongSession(songId, userId, color)

  const existing = state.sessions.find((s) => s.songId === songId && s.userId === userId)
  const sessions = existing
    ? state.sessions.map((s) =>
        s.songId === songId && s.userId === userId
          ? { ...s, lastSeenAt: nowIso(), color }
          : s,
      )
    : [...state.sessions, { songId, userId, color, lastSeenAt: nowIso() }]

  setState({ sessions })
  return color
}

export async function proposeVerse(input: {
  slotId: string
  authorId: string
  text: string
  parentProposalId?: string
  sessionColor: string
}): Promise<VerseProposal> {
  const text = input.text.trim()
  if (!text) throw new Error('Verso vazio')

  const slot = state.slots.find((s) => s.id === input.slotId)
  if (!slot) throw new Error('Slot não encontrado')
  const stanza = state.stanzas.find((s) => s.id === slot.stanzaId)
  if (!stanza) throw new Error('Estrofe não encontrada')

  const parent = input.parentProposalId
    ? state.proposals.find((p) => p.id === input.parentProposalId)
    : undefined
  if (parent) {
    const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
    if (normalize(text) === normalize(parent.text)) {
      throw new Error('Altere o verso — não pode ser igual à base')
    }
  }

  let segments: TextSegment[]
  if (parent) {
    segments = buildColoredSegments(
      text,
      input.authorId,
      input.sessionColor,
      parent.segments,
    )
  } else {
    segments = buildColoredSegments(text, input.authorId, input.sessionColor)
  }

  if (usingFirebase) {
    const proposal = await fbProposeVerse({
      slotId: input.slotId,
      songId: stanza.songId,
      stanzaId: stanza.id,
      authorId: input.authorId,
      text,
      parentProposalId: input.parentProposalId,
      sessionColor: input.sessionColor,
      parentSegments: parent?.segments,
    })
    setState({ proposals: [...state.proposals, proposal] })
    return proposal
  }

  const proposal: VerseProposal = {
    id: createId('prp'),
    slotId: input.slotId,
    authorId: input.authorId,
    text,
    parentProposalId: input.parentProposalId,
    segments,
    createdAt: nowIso(),
  }
  setState({ proposals: [...state.proposals, proposal] })
  return proposal
}

export async function castVote(input: {
  proposalId: string
  userId: string
  kind: VoteKind
}): Promise<void> {
  const existing = state.votes.find(
    (v) => v.proposalId === input.proposalId && v.userId === input.userId,
  )

  // Clicking the same kind again clears the vote
  if (existing?.kind === input.kind) {
    if (usingFirebase) await fbRemoveVote(input.proposalId, input.userId)
    setState({
      votes: state.votes.filter(
        (v) => !(v.proposalId === input.proposalId && v.userId === input.userId),
      ),
    })
    return
  }

  if (usingFirebase) {
    const proposal = state.proposals.find((p) => p.id === input.proposalId)
    const slot = state.slots.find((s) => s.id === proposal?.slotId)
    const stanza = state.stanzas.find((s) => s.id === slot?.stanzaId)
    if (!proposal || !slot || !stanza) throw new Error('Proposta inválida')
    const vote = await fbCastVote({
      proposalId: input.proposalId,
      songId: stanza.songId,
      stanzaId: stanza.id,
      userId: input.userId,
      kind: input.kind,
    })
    setState({
      votes: [
        ...state.votes.filter(
          (v) => !(v.proposalId === vote.proposalId && v.userId === vote.userId),
        ),
        vote,
      ],
    })
    return
  }

  const votes = existing
    ? state.votes.map((v) =>
        v.id === existing.id ? { ...v, kind: input.kind, createdAt: nowIso() } : v,
      )
    : [
        ...state.votes,
        {
          id: createId('vot'),
          proposalId: input.proposalId,
          userId: input.userId,
          kind: input.kind,
          createdAt: nowIso(),
        },
      ]
  setState({ votes })
}

export async function acceptProposal(proposalId: string, actorId: string): Promise<void> {
  const proposal = state.proposals.find((p) => p.id === proposalId)
  if (!proposal) throw new Error('Proposta não encontrada')
  const slot = state.slots.find((s) => s.id === proposal.slotId)
  if (!slot) throw new Error('Slot não encontrado')
  const stanza = state.stanzas.find((s) => s.id === slot.stanzaId)
  const song = stanza ? state.songs.find((s) => s.id === stanza.songId) : undefined
  if (!song) throw new Error('Música não encontrada')
  if (song.createdBy !== actorId) {
    throw new Error('Só quem criou a música pode definir a definitiva')
  }

  await castVote({ proposalId, userId: actorId, kind: 'accept' })
  if (usingFirebase) await fbAcceptProposal(slot.id, proposalId)
  setState({
    slots: getState().slots.map((s) =>
      s.id === slot.id ? { ...s, acceptedProposalId: proposalId } : s,
    ),
  })
}

export function stanzaComplete(stanzaId: string): boolean {
  const slots = state.slots.filter((s) => s.stanzaId === stanzaId)
  const meaningful = slots.filter(
    (s) =>
      Boolean(s.acceptedProposalId) || state.proposals.some((p) => p.slotId === s.id),
  )
  return (
    meaningful.length > 0 && meaningful.every((s) => Boolean(s.acceptedProposalId))
  )
}

export function voteCounts(proposalId: string): Record<VoteKind, number> {
  const votes = state.votes.filter((v) => v.proposalId === proposalId)
  return {
    dislike: votes.filter((v) => v.kind === 'dislike').length,
    continue: votes.filter((v) => v.kind === 'continue').length,
    accept: votes.filter((v) => v.kind === 'accept').length,
  }
}

// ——— Audio ———

export async function saveAudioTake(input: {
  stanzaId: string
  userId: string
  audioData: string
  durationMs: number
}): Promise<AudioTake> {
  if (!stanzaComplete(input.stanzaId)) {
    throw new Error('Estrofe ainda não está completa')
  }
  const stanza = state.stanzas.find((s) => s.id === input.stanzaId)
  if (!stanza) throw new Error('Estrofe não encontrada')

  if (usingFirebase) {
    const take = await fbSaveAudioTake({
      songId: stanza.songId,
      stanzaId: input.stanzaId,
      userId: input.userId,
      audioData: input.audioData,
      durationMs: input.durationMs,
    })
    setState({ audioTakes: [...state.audioTakes, take] })
    return take
  }

  const take: AudioTake = {
    id: createId('aud'),
    stanzaId: input.stanzaId,
    userId: input.userId,
    audioData: input.audioData,
    durationMs: input.durationMs,
    createdAt: nowIso(),
  }
  setState({ audioTakes: [...state.audioTakes, take] })
  return take
}

export function takesForStanza(stanzaId: string): AudioTake[] {
  return state.audioTakes
    .filter((t) => t.stanzaId === stanzaId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function resetAllData(): void {
  state = emptyState()
  emit()
}

export { usingFirebase }
