import { SESSION_COLORS } from '@/types/domain'

/** Pick a color not yet used in the group. Extends palette if needed. */
export function pickUniqueGroupColor(used: string[]): string {
  const usedSet = new Set(used.map((c) => c.toLowerCase()))
  const free = SESSION_COLORS.find((c) => !usedSet.has(c.toLowerCase()))
  if (free) return free

  for (let i = 0; i < 64; i++) {
    const hue = (i * 47 + used.length * 13) % 360
    const color = hslToHex(hue, 58, 46)
    if (!usedSet.has(color.toLowerCase())) return color
  }

  return `#${((Date.now() * (used.length + 1)) & 0xffffff).toString(16).padStart(6, '0')}`
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
