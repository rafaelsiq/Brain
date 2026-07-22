import type { Stanza } from '@/types/domain'

export function stanzaLabel(stanza: Pick<Stanza, 'index' | 'title'>): string {
  const custom = stanza.title?.trim()
  return custom || `Estrofe ${stanza.index + 1}`
}
