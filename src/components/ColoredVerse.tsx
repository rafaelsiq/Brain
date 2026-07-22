import type { TextSegment } from '@/types/domain'

export function ColoredVerse({
  segments,
  mode = 'author',
}: {
  segments: TextSegment[]
  /** author = colored text (pool); definitive = black text + colored underline */
  mode?: 'author' | 'definitive'
}) {
  return (
    <p className={`segmented-text ${mode === 'definitive' ? 'definitive' : ''}`}>
      {segments.map((seg, i) => (
        <span
          key={`${i}-${seg.authorId}`}
          style={
            mode === 'definitive'
              ? { borderBottomColor: seg.color }
              : { color: seg.color }
          }
        >
          {seg.text}
        </span>
      ))}
    </p>
  )
}
