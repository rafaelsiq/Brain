import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteField,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadString } from 'firebase/storage'
import { firebaseAuth, firebaseStorage, firestore, usingFirebase } from '@/lib/firebase'
import { createId, makeInviteCode, nowIso } from '@/data/persist'
import { pickUniqueGroupColor } from '@/lib/color'
import { buildColoredSegments } from '@/lib/diff'
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
  SongSessionMember,
  SongVisibility,
  Stanza,
  TextSegment,
  VerseProposal,
  Vote,
  VoteKind,
} from '@/types/domain'

function db() {
  if (!firestore) throw new Error('Firebase não configurado')
  return firestore
}

function auth() {
  if (!firebaseAuth) throw new Error('Firebase Auth não configurado')
  return firebaseAuth
}

function storage() {
  if (!firebaseStorage) throw new Error('Firebase Storage não configurado')
  return firebaseStorage
}

/** Firestore rejects `undefined` field values. */
function clean<T extends object>(data: T): T {
  const out = { ...(data as Record<string, unknown>) }
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key]
  }
  return out as T
}

export { usingFirebase }

function mapProfile(id: string, data: Record<string, unknown>): Profile {
  return {
    id,
    email: String(data.email ?? ''),
    name: String(data.name ?? ''),
    avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  }
}

export function watchAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth(), callback)
}

export async function fbRegister(input: {
  name: string
  email: string
  password: string
}): Promise<Profile> {
  const email = input.email.trim().toLowerCase()
  const cred = await createUserWithEmailAndPassword(auth(), email, input.password)
  await updateAuthProfile(cred.user, { displayName: input.name.trim() })
  const profile: Profile = {
    id: cred.user.uid,
    email,
    name: input.name.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await setDoc(doc(db(), 'profiles', profile.id), clean({ ...profile }))
  return profile
}

export async function fbLogin(email: string, password: string): Promise<Profile> {
  const cred = await signInWithEmailAndPassword(auth(), email.trim().toLowerCase(), password)
  const snap = await getDoc(doc(db(), 'profiles', cred.user.uid))
  if (!snap.exists()) {
    const profile: Profile = {
      id: cred.user.uid,
      email: cred.user.email ?? email,
      name: cred.user.displayName ?? email.split('@')[0],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await setDoc(doc(db(), 'profiles', profile.id), clean({ ...profile }))
    return profile
  }
  return mapProfile(snap.id, snap.data() as Record<string, unknown>)
}

export async function fbLogout(): Promise<void> {
  await signOut(auth())
}

export async function fbUpdateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'name' | 'avatarUrl'>>,
): Promise<Profile> {
  const refProfile = doc(db(), 'profiles', userId)
  const snap = await getDoc(refProfile)
  if (!snap.exists()) throw new Error('Perfil não encontrado')
  const next = {
    ...snap.data(),
    ...patch,
    updatedAt: nowIso(),
  }
  await updateDoc(refProfile, clean(next))
  if (patch.name && auth().currentUser) {
    await updateAuthProfile(auth().currentUser!, { displayName: patch.name })
  }
  return mapProfile(userId, next as Record<string, unknown>)
}

export async function fbLoadUserUniverse(userId: string): Promise<Partial<AppState>> {
  const profileSnap = await getDoc(doc(db(), 'profiles', userId))
  const profiles: Profile[] = profileSnap.exists()
    ? [mapProfile(profileSnap.id, profileSnap.data() as Record<string, unknown>)]
    : []

  const memberSnaps = await getDocs(query(collection(db(), 'members'), where('userId', '==', userId)))
  const members: GroupMember[] = memberSnaps.docs.map((d) => ({
    ...(d.data() as GroupMember),
    id: d.id,
  }))

  const groupIds = [...new Set(members.map((m) => m.groupId))]
  const groups: Group[] = []
  for (const gid of groupIds) {
    const g = await getDoc(doc(db(), 'groups', gid))
    if (g.exists()) groups.push({ id: g.id, ...(g.data() as Omit<Group, 'id'>) })
  }

  // all members of those groups (for colors / roles)
  const allMembers: GroupMember[] = [...members]
  for (const gid of groupIds) {
    const snaps = await getDocs(query(collection(db(), 'members'), where('groupId', '==', gid)))
    for (const d of snaps.docs) {
      const m = { ...(d.data() as GroupMember), id: d.id }
      if (!allMembers.some((x) => x.id === m.id)) allMembers.push(m)
    }
  }

  // profiles of fellow members
  const otherIds = [...new Set(allMembers.map((m) => m.userId))].filter((id) => id !== userId)
  for (const oid of otherIds) {
    const p = await getDoc(doc(db(), 'profiles', oid))
    if (p.exists() && !profiles.some((x) => x.id === oid)) {
      profiles.push(mapProfile(p.id, p.data() as Record<string, unknown>))
    }
  }

  const songs: Song[] = []
  for (const gid of groupIds) {
    const snaps = await getDocs(query(collection(db(), 'songs'), where('groupId', '==', gid)))
    for (const d of snaps.docs) {
      songs.push({ id: d.id, ...(d.data() as Omit<Song, 'id'>) })
    }
  }

  const songIds = songs.map((s) => s.id)
  const stanzas: Stanza[] = []
  const slots: LineSlot[] = []
  const proposals: VerseProposal[] = []
  const votes: Vote[] = []
  const participants: SongParticipant[] = []
  const sessions: SongSessionMember[] = []
  const audioTakes: AudioTake[] = []

  for (const sid of songIds) {
    const [stz, slt, prp, vot, prt, ses, aud] = await Promise.all([
      getDocs(query(collection(db(), 'stanzas'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'slots'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'proposals'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'votes'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'participants'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'sessions'), where('songId', '==', sid))),
      getDocs(query(collection(db(), 'audioTakes'), where('songId', '==', sid))),
    ])
    stanzas.push(...stz.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Stanza, 'id'>) })))
    slots.push(...slt.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LineSlot, 'id'>) })))
    proposals.push(...prp.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VerseProposal, 'id'>) })))
    votes.push(...vot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vote, 'id'>) })))
    participants.push(
      ...prt.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongParticipant, 'id'>) })),
    )
    sessions.push(...ses.docs.map((d) => d.data() as SongSessionMember))
    audioTakes.push(...aud.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AudioTake, 'id'>) })))
  }

  return {
    profiles,
    groups,
    members: allMembers,
    songs,
    stanzas,
    slots,
    proposals,
    votes,
    participants,
    sessions,
    audioTakes,
    accounts: [],
    currentUserId: userId,
  }
}

export async function fbCreateGroup(input: {
  name: string
  description: string
  createdBy: string
}): Promise<{ group: Group; member: GroupMember }> {
  const groupId = createId('grp')
  const inviteCode = makeInviteCode()
  const now = nowIso()
  const group: Group = {
    id: groupId,
    name: input.name.trim(),
    description: input.description.trim(),
    inviteCode,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }
  const member: GroupMember = {
    id: `${groupId}_${input.createdBy}`,
    groupId,
    userId: input.createdBy,
    role: 'admin',
    color: pickUniqueGroupColor([]),
    joinedAt: now,
  }
  const batch = writeBatch(db())
  batch.set(doc(db(), 'groups', groupId), group)
  batch.set(doc(db(), 'members', member.id), member)
  batch.set(doc(db(), 'inviteCodes', inviteCode), { groupId, inviteCode })
  await batch.commit()
  return { group, member }
}

export async function fbUpdateGroup(
  groupId: string,
  patch: Partial<Pick<Group, 'name' | 'description' | 'coverUrl'>>,
): Promise<void> {
  await updateDoc(doc(db(), 'groups', groupId), clean({ ...patch, updatedAt: nowIso() }))
}

export async function fbDeleteGroup(groupId: string): Promise<void> {
  const group = await getDoc(doc(db(), 'groups', groupId))
  if (!group.exists()) return
  const inviteCode = String(group.data().inviteCode ?? '')
  const members = await getDocs(query(collection(db(), 'members'), where('groupId', '==', groupId)))
  const songs = await getDocs(query(collection(db(), 'songs'), where('groupId', '==', groupId)))
  const batch = writeBatch(db())
  batch.delete(doc(db(), 'groups', groupId))
  if (inviteCode) batch.delete(doc(db(), 'inviteCodes', inviteCode))
  members.docs.forEach((d) => batch.delete(d.ref))
  for (const s of songs.docs) {
    await fbDeleteSong(s.id)
  }
  await batch.commit()
}

export async function fbJoinGroupByCode(
  inviteCode: string,
  userId: string,
): Promise<{ group: Group; member: GroupMember }> {
  const code = inviteCode.trim().toUpperCase()
  const inv = await getDoc(doc(db(), 'inviteCodes', code))
  if (!inv.exists()) throw new Error('Código de convite inválido')
  const groupId = String(inv.data().groupId)
  const gSnap = await getDoc(doc(db(), 'groups', groupId))
  if (!gSnap.exists()) throw new Error('Grupo não encontrado')
  const group = { id: gSnap.id, ...(gSnap.data() as Omit<Group, 'id'>) }

  const existing = await getDocs(
    query(
      collection(db(), 'members'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
    ),
  )
  if (!existing.empty) {
    return { group, member: existing.docs[0].data() as GroupMember }
  }

  const all = await getDocs(query(collection(db(), 'members'), where('groupId', '==', groupId)))
  const used = all.docs.map((d) => String(d.data().color))
  const member: GroupMember = {
    id: `${groupId}_${userId}`,
    groupId,
    userId,
    role: 'musician',
    color: pickUniqueGroupColor(used),
    joinedAt: nowIso(),
  }
  await setDoc(doc(db(), 'members', member.id), member)
  return { group, member }
}

export async function fbSetMemberRole(memberId: string, role: GroupRole): Promise<void> {
  await updateDoc(doc(db(), 'members', memberId), { role })
}

export async function fbRemoveMember(memberId: string): Promise<void> {
  await deleteDoc(doc(db(), 'members', memberId))
}

export async function fbSetMemberColor(memberId: string, color: string): Promise<void> {
  await updateDoc(doc(db(), 'members', memberId), { color })
}

export async function fbCreateSong(input: {
  groupId: string
  title: string
  visibility: SongVisibility
  createdBy: string
  key?: string
  bpm?: number
  stanzaCount?: number
  linesPerStanza?: number
  participantIds?: string[]
}): Promise<{
  song: Song
  stanzas: Stanza[]
  slots: LineSlot[]
  participants: SongParticipant[]
}> {
  const songId = createId('sng')
  const now = nowIso()
  const song = clean({
    id: songId,
    groupId: input.groupId,
    title: input.title.trim(),
    visibility: input.visibility,
    key: input.key,
    bpm: input.bpm,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }) as Song
  const stanzaCount = input.stanzaCount ?? 0
  const linesPerStanza = input.linesPerStanza ?? 0
  const stanzas: Stanza[] = []
  const slots: LineSlot[] = []
  const batch = writeBatch(db())
  batch.set(doc(db(), 'songs', songId), song)

  for (let i = 0; i < stanzaCount; i++) {
    const stanzaId = createId('stz')
    const stanza: Stanza = { id: stanzaId, songId, index: i, createdAt: now }
    stanzas.push(stanza)
    batch.set(doc(db(), 'stanzas', stanzaId), { ...stanza })
    for (let j = 0; j < linesPerStanza; j++) {
      const slotId = createId('slt')
      const slot: LineSlot & { songId: string } = {
        id: slotId,
        stanzaId,
        songId,
        index: j,
      }
      slots.push(slot)
      batch.set(doc(db(), 'slots', slotId), slot)
    }
  }

  const participants: SongParticipant[] =
    input.visibility === 'private'
      ? Array.from(new Set([input.createdBy, ...(input.participantIds ?? [])])).map((userId) => ({
          id: createId('prt'),
          songId,
          userId,
        }))
      : []
  participants.forEach((p) => batch.set(doc(db(), 'participants', p.id), p))

  await batch.commit()
  return { song, stanzas, slots, participants }
}

export async function fbUpdateSong(
  songId: string,
  patch: Partial<Pick<Song, 'title' | 'visibility' | 'key' | 'bpm'>>,
): Promise<void> {
  await updateDoc(doc(db(), 'songs', songId), clean({ ...patch, updatedAt: nowIso() }))
}

export async function fbUpdateStanza(
  stanzaId: string,
  patch: Partial<Pick<Stanza, 'title'>>,
): Promise<void> {
  const title = patch.title?.trim()
  if (title) {
    await updateDoc(doc(db(), 'stanzas', stanzaId), { title })
  } else {
    await updateDoc(doc(db(), 'stanzas', stanzaId), { title: deleteField() })
  }
}

export async function fbDeleteSong(songId: string): Promise<void> {
  const [stz, slt, prp, vot, prt, ses, aud] = await Promise.all([
    getDocs(query(collection(db(), 'stanzas'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'slots'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'proposals'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'votes'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'participants'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'sessions'), where('songId', '==', songId))),
    getDocs(query(collection(db(), 'audioTakes'), where('songId', '==', songId))),
  ])
  const batch = writeBatch(db())
  batch.delete(doc(db(), 'songs', songId))
  ;[...stz.docs, ...slt.docs, ...prp.docs, ...vot.docs, ...prt.docs, ...ses.docs, ...aud.docs].forEach(
    (d) => batch.delete(d.ref),
  )
  await batch.commit()
}

export async function fbAddStanza(
  songId: string,
  index: number,
  lines = 4,
): Promise<{ stanza: Stanza; slots: LineSlot[] }> {
  const stanzaId = createId('stz')
  const stanza: Stanza = { id: stanzaId, songId, index, createdAt: nowIso() }
  const slots: LineSlot[] = []
  const batch = writeBatch(db())
  batch.set(doc(db(), 'stanzas', stanzaId), { ...stanza, songId })
  for (let j = 0; j < lines; j++) {
    const slotId = createId('slt')
    const slot = { id: slotId, stanzaId, songId, index: j }
    slots.push(slot)
    batch.set(doc(db(), 'slots', slotId), slot)
  }
  await batch.commit()
  return { stanza, slots }
}

/** Propose a verse on the open slot (no auto-accept). Creates stanza/slot if needed. */
export async function fbAppendVerse(input: {
  songId: string
  stanza?: Stanza
  createStanzaIndex?: number
  /** Existing open slot to receive the proposal; omit to create a new slot */
  slot?: LineSlot
  slotIndex: number
  authorId: string
  text: string
  sessionColor: string
  parentSegments?: TextSegment[]
}): Promise<{
  stanza: Stanza
  stanzaCreated: boolean
  slot: LineSlot
  slotCreated: boolean
  proposal: VerseProposal
}> {
  const text = input.text.trim()
  if (!text) throw new Error('Verso vazio')

  const batch = writeBatch(db())
  let stanza = input.stanza
  let stanzaCreated = false
  if (!stanza) {
    const stanzaId = createId('stz')
    stanza = {
      id: stanzaId,
      songId: input.songId,
      index: input.createStanzaIndex ?? 0,
      createdAt: nowIso(),
    }
    stanzaCreated = true
    batch.set(doc(db(), 'stanzas', stanzaId), { ...stanza })
  }

  let slot = input.slot
  let slotCreated = false
  if (!slot) {
    const slotId = createId('slt')
    slot = {
      id: slotId,
      stanzaId: stanza.id,
      index: input.slotIndex,
    }
    slotCreated = true
    batch.set(doc(db(), 'slots', slotId), {
      ...slot,
      songId: input.songId,
    })
  }

  const segments = buildColoredSegments(
    text,
    input.authorId,
    input.sessionColor,
    input.parentSegments,
  )
  const proposal = clean({
    id: createId('prp'),
    slotId: slot.id,
    songId: input.songId,
    stanzaId: stanza.id,
    authorId: input.authorId,
    text,
    segments,
    createdAt: nowIso(),
  }) as VerseProposal & { songId: string; stanzaId: string }
  batch.set(doc(db(), 'proposals', proposal.id), proposal)
  await batch.commit()
  return { stanza, stanzaCreated, slot, slotCreated, proposal }
}

export async function fbStartNextStanza(songId: string, index: number): Promise<Stanza> {
  const created = await fbAddStanza(songId, index, 0)
  return created.stanza
}

export async function fbDeleteStanza(
  stanza: Stanza,
  remaining: Stanza[],
): Promise<void> {
  const [slots, proposals, votes, audio] = await Promise.all([
    getDocs(query(collection(db(), 'slots'), where('stanzaId', '==', stanza.id))),
    getDocs(query(collection(db(), 'proposals'), where('stanzaId', '==', stanza.id))),
    getDocs(query(collection(db(), 'votes'), where('stanzaId', '==', stanza.id))),
    getDocs(query(collection(db(), 'audioTakes'), where('stanzaId', '==', stanza.id))),
  ])
  const batch = writeBatch(db())
  batch.delete(doc(db(), 'stanzas', stanza.id))
  ;[...slots.docs, ...proposals.docs, ...votes.docs, ...audio.docs].forEach((d) => batch.delete(d.ref))
  remaining
    .filter((s) => s.songId === stanza.songId)
    .forEach((s) => batch.update(doc(db(), 'stanzas', s.id), { index: s.index }))
  await batch.commit()
}

export async function fbJoinSongSession(
  songId: string,
  userId: string,
  color: string,
): Promise<SongSessionMember> {
  const session: SongSessionMember = {
    songId,
    userId,
    color,
    lastSeenAt: nowIso(),
  }
  await setDoc(doc(db(), 'sessions', `${songId}_${userId}`), session)
  return session
}

export async function fbProposeVerse(input: {
  slotId: string
  songId: string
  stanzaId: string
  authorId: string
  text: string
  parentProposalId?: string
  sessionColor: string
  parentSegments?: TextSegment[]
}): Promise<VerseProposal> {
  const text = input.text.trim()
  if (!text) throw new Error('Verso vazio')
  const segments = buildColoredSegments(
    text,
    input.authorId,
    input.sessionColor,
    input.parentSegments,
  )
  const proposal = clean({
    id: createId('prp'),
    slotId: input.slotId,
    songId: input.songId,
    stanzaId: input.stanzaId,
    authorId: input.authorId,
    text,
    parentProposalId: input.parentProposalId,
    segments,
    createdAt: nowIso(),
  }) as VerseProposal & { songId: string; stanzaId: string }
  await setDoc(doc(db(), 'proposals', proposal.id), proposal)
  return proposal
}

export async function fbCastVote(input: {
  proposalId: string
  songId: string
  stanzaId: string
  userId: string
  kind: VoteKind
}): Promise<Vote> {
  const voteId = `${input.proposalId}_${input.userId}`
  const vote: Vote & { songId: string; stanzaId: string } = {
    id: voteId,
    proposalId: input.proposalId,
    songId: input.songId,
    stanzaId: input.stanzaId,
    userId: input.userId,
    kind: input.kind,
    createdAt: nowIso(),
  }
  await setDoc(doc(db(), 'votes', voteId), vote)
  return vote
}

export async function fbRemoveVote(proposalId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db(), 'votes', `${proposalId}_${userId}`))
}

export async function fbAcceptProposal(slotId: string, proposalId: string): Promise<void> {
  await updateDoc(doc(db(), 'slots', slotId), { acceptedProposalId: proposalId })
}

export async function fbSaveAudioTake(input: {
  songId: string
  stanzaId: string
  userId: string
  audioData: string
  durationMs: number
}): Promise<AudioTake> {
  const takeId = createId('aud')
  const path = `audio-takes/${input.songId}/${input.stanzaId}/${takeId}.webm`
  const storageRef = ref(storage(), path)
  await uploadString(storageRef, input.audioData, 'data_url')
  const url = await getDownloadURL(storageRef)
  const take: AudioTake & { songId: string; storagePath: string } = {
    id: takeId,
    songId: input.songId,
    stanzaId: input.stanzaId,
    userId: input.userId,
    audioData: url,
    durationMs: input.durationMs,
    createdAt: nowIso(),
    storagePath: path,
  }
  await setDoc(doc(db(), 'audioTakes', takeId), take)
  return take
}

/** Live sync for a song (editor / detail). */
export function watchSongData(
  songId: string,
  onData: (partial: Partial<AppState>) => void,
): Unsubscribe {
  const unsubs: Unsubscribe[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let queued = false

  const bump = async () => {
    if (inFlight) {
      queued = true
      return
    }
    inFlight = true
    try {
      const [stz, slt, prp, vot, ses, aud] = await Promise.all([
        getDocs(query(collection(db(), 'stanzas'), where('songId', '==', songId))),
        getDocs(query(collection(db(), 'slots'), where('songId', '==', songId))),
        getDocs(query(collection(db(), 'proposals'), where('songId', '==', songId))),
        getDocs(query(collection(db(), 'votes'), where('songId', '==', songId))),
        getDocs(query(collection(db(), 'sessions'), where('songId', '==', songId))),
        getDocs(query(collection(db(), 'audioTakes'), where('songId', '==', songId))),
      ])
      onData({
        stanzas: stz.docs.map((d) => {
          const data = d.data() as Omit<Stanza, 'id'>
          return { ...data, id: d.id }
        }),
        slots: slt.docs.map((d) => {
          const data = d.data() as Omit<LineSlot, 'id'> & { songId?: string }
          return { ...data, id: d.id }
        }),
        proposals: prp.docs.map((d) => {
          const data = d.data() as Omit<VerseProposal, 'id'> & { songId?: string }
          return { ...data, id: d.id }
        }),
        votes: vot.docs.map((d) => {
          const data = d.data() as Omit<Vote, 'id'> & { songId?: string }
          return { ...data, id: d.id }
        }),
        sessions: ses.docs.map((d) => d.data() as SongSessionMember),
        audioTakes: aud.docs.map((d) => {
          const data = d.data() as Omit<AudioTake, 'id'> & { songId?: string }
          return { ...data, id: d.id }
        }),
      })
    } finally {
      inFlight = false
      if (queued) {
        queued = false
        void bump()
      }
    }
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void bump()
    }, 80)
  }

  for (const name of ['stanzas', 'slots', 'proposals', 'votes', 'sessions', 'audioTakes'] as const) {
    unsubs.push(
      onSnapshot(query(collection(db(), name), where('songId', '==', songId)), () => {
        schedule()
      }),
    )
  }
  void bump()
  return () => {
    if (timer) clearTimeout(timer)
    unsubs.forEach((u) => u())
  }
}
