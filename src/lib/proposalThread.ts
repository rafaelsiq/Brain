import type { VerseProposal } from '@/types/domain'

/** Flatten proposals into parent→children thread order with depth. */
export function orderProposalThread<T extends { proposal: VerseProposal }>(
  items: T[],
  sortRoots?: (a: T, b: T) => number,
): { item: T; depth: number }[] {
  const byId = new Map(items.map((item) => [item.proposal.id, item]))
  const children = new Map<string, T[]>()
  const roots: T[] = []

  for (const item of items) {
    const parentId = item.proposal.parentProposalId
    if (parentId && byId.has(parentId)) {
      const list = children.get(parentId) ?? []
      list.push(item)
      children.set(parentId, list)
    } else {
      roots.push(item)
    }
  }

  const byTime = (a: T, b: T) => a.proposal.createdAt.localeCompare(b.proposal.createdAt)
  roots.sort(sortRoots ?? byTime)
  for (const list of children.values()) list.sort(byTime)

  const out: { item: T; depth: number }[] = []
  function walk(item: T, depth: number) {
    out.push({ item, depth })
    for (const child of children.get(item.proposal.id) ?? []) {
      walk(child, depth + 1)
    }
  }
  for (const root of roots) walk(root, 0)
  return out
}
