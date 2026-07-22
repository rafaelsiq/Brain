/** Simple orthographic rhyme ending for pt-BR MVP */
export function rhymeEnding(line: string): string {
  const cleaned = line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  const last = words[words.length - 1] ?? ''
  if (last.length <= 2) return last
  // last 3 letters as rough ending; prefer vowel-led ending when longer
  if (last.length >= 4) {
    const slice = last.slice(-3)
    const vowelIdx = [...slice].findIndex((c) => 'aeiou'.includes(c))
    if (vowelIdx >= 0) return slice.slice(vowelIdx)
  }
  return last.slice(-2)
}

export type RhymeScheme = {
  label: string
  ending: string
  color: string
}

const RHYME_MARKER_COLORS = ['#E8A838', '#3D9B8F', '#D45D5D', '#6B7FD7', '#C45DB3']

/** Assign scheme letters A, B, C… to accepted lines in a stanza */
export function computeRhymeScheme(lines: string[]): RhymeScheme[] {
  const endingToLabel = new Map<string, string>()
  let next = 0
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  return lines.map((line) => {
    const ending = rhymeEnding(line)
    let label = endingToLabel.get(ending)
    if (!label) {
      label = letters[next % letters.length]
      endingToLabel.set(ending, label)
      next++
    }
    const color = RHYME_MARKER_COLORS[(label.charCodeAt(0) - 65) % RHYME_MARKER_COLORS.length]
    return { label, ending, color }
  })
}
