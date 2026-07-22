import type { TextSegment } from '@/types/domain'

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? []
}

/** Word-level LCS diff → colored segments for fork proposals */
export function buildColoredSegments(
  newText: string,
  authorId: string,
  authorColor: string,
  parentSegments?: TextSegment[],
): TextSegment[] {
  if (!parentSegments || parentSegments.length === 0) {
    return [{ text: newText, authorId, color: authorColor }]
  }

  const parentText = parentSegments.map((s) => s.text).join('')
  const parentTokens = tokenize(parentText)
  const newTokens = tokenize(newText)

  // Map each parent token to its author/color
  const parentMeta: { token: string; authorId: string; color: string }[] = []
  let cursor = 0
  for (const seg of parentSegments) {
    const toks = tokenize(seg.text)
    for (const t of toks) {
      parentMeta.push({ token: t, authorId: seg.authorId, color: seg.color })
      cursor += t.length
    }
  }
  void cursor

  const lcs = longestCommonSubsequence(
    parentTokens.map((t) => t.trim() === '' ? '\u00a0' + t : t),
    newTokens.map((t) => t.trim() === '' ? '\u00a0' + t : t),
  )

  // Match equal non-whitespace tokens by content order via LCS indices
  const parentNorm = parentTokens.map(normKey)
  const newNorm = newTokens.map(normKey)
  const pairs = lcsIndexPairs(parentNorm, newNorm)

  const parentMatched = new Set(pairs.map((p) => p.a))
  const newMatched = new Map(pairs.map((p) => [p.b, p.a]))

  void parentMatched
  void lcs

  const raw: TextSegment[] = []
  for (let i = 0; i < newTokens.length; i++) {
    const token = newTokens[i]
    const matchedParentIdx = newMatched.get(i)
    if (matchedParentIdx !== undefined && parentMeta[matchedParentIdx]) {
      const meta = parentMeta[matchedParentIdx]
      raw.push({ text: token, authorId: meta.authorId, color: meta.color })
    } else {
      raw.push({ text: token, authorId, color: authorColor })
    }
  }

  return mergeAdjacent(raw)
}

function normKey(t: string): string {
  return t.trim() === '' ? `__ws:${t.length}` : t
}

function lcsIndexPairs(a: string[], b: string[]): { a: number; b: number }[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const pairs: { a: number; b: number }[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push({ a: i - 1, b: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return pairs.reverse()
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const pairs = lcsIndexPairs(a, b)
  return pairs.map((p) => a[p.a])
}

function mergeAdjacent(segments: TextSegment[]): TextSegment[] {
  const out: TextSegment[] = []
  for (const seg of segments) {
    const last = out[out.length - 1]
    if (last && last.authorId === seg.authorId && last.color === seg.color) {
      last.text += seg.text
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

export function segmentsToText(segments: TextSegment[]): string {
  return segments.map((s) => s.text).join('')
}
