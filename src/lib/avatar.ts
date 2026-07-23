/** Initials from a display name (up to 2 letters). */
export function profileInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Resize/compress an image File to a JPEG data URL (~512px max side).
 * Keeps uploads under Storage rule limits.
 */
export function compressImageToDataUrl(
  file: File,
  maxSide = 512,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        reject(new Error('Não foi possível processar a imagem'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Imagem inválida'))
    }
    img.src = url
  })
}
