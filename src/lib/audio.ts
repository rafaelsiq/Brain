export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export type RecorderHandle = {
  start: () => void
  stop: () => Promise<{ blob: Blob; dataUrl: string; durationMs: number }>
  isRecording: () => boolean
}

export async function createRecorder(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
  let recorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let startedAt = 0

  return {
    start() {
      chunks = []
      recorder = new MediaRecorder(stream, { mimeType: mime })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      startedAt = Date.now()
      recorder.start()
    },
    async stop() {
      const rec = recorder
      if (!rec) throw new Error('Recorder not started')
      const durationMs = Date.now() - startedAt
      const blob = await new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }))
        rec.stop()
      })
      stream.getTracks().forEach((t) => t.stop())
      const dataUrl = await blobToDataUrl(blob)
      return { blob, dataUrl, durationMs }
    },
    isRecording() {
      return recorder?.state === 'recording'
    },
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function playDataUrl(dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(dataUrl)
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Playback failed'))
    void audio.play()
  })
}
