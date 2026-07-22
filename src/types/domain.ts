export type GroupRole = 'admin' | 'musician'
export type SongVisibility = 'private' | 'public_in_group'
export type VoteKind = 'dislike' | 'continue' | 'accept'

export interface Profile {
  id: string
  email: string
  name: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AuthAccount {
  id: string
  email: string
  password: string
  profileId: string
}

export interface Group {
  id: string
  name: string
  description: string
  coverUrl?: string
  inviteCode: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: GroupRole
  /** Unique within the group — used in collaborative editing */
  color: string
  joinedAt: string
}

export interface Song {
  id: string
  groupId: string
  title: string
  key?: string
  bpm?: number
  visibility: SongVisibility
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Users allowed into a private song */
export interface SongParticipant {
  id: string
  songId: string
  userId: string
}

export interface Stanza {
  id: string
  songId: string
  index: number
  /** Custom display name; falls back to "Estrofe N" when missing/empty. */
  title?: string
  createdAt: string
}

export interface LineSlot {
  id: string
  stanzaId: string
  index: number
  acceptedProposalId?: string
}

export interface TextSegment {
  text: string
  authorId: string
  color: string
}

export interface VerseProposal {
  id: string
  slotId: string
  authorId: string
  text: string
  parentProposalId?: string
  segments: TextSegment[]
  createdAt: string
}

export interface Vote {
  id: string
  proposalId: string
  userId: string
  kind: VoteKind
  createdAt: string
}

export interface AudioTake {
  id: string
  stanzaId: string
  userId: string
  /** data URL or storage path */
  audioData: string
  durationMs: number
  createdAt: string
}

export interface SongSessionMember {
  songId: string
  userId: string
  color: string
  lastSeenAt: string
}

export interface AppState {
  accounts: AuthAccount[]
  profiles: Profile[]
  groups: Group[]
  members: GroupMember[]
  songs: Song[]
  participants: SongParticipant[]
  stanzas: Stanza[]
  slots: LineSlot[]
  proposals: VerseProposal[]
  votes: Vote[]
  audioTakes: AudioTake[]
  sessions: SongSessionMember[]
  currentUserId: string | null
}

export const SESSION_COLORS = [
  '#E8A838',
  '#3D9B8F',
  '#D45D5D',
  '#6B7FD7',
  '#C45DB3',
  '#5DAD4E',
  '#D4863B',
  '#4A9BC7',
] as const
