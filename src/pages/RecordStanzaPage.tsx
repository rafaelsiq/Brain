import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '@/components/Page'
import { createRecorder, playDataUrl, requestMicPermission, type RecorderHandle } from '@/lib/audio'
import {
  canAccessSong,
  currentProfile,
  saveAudioTake,
  stanzaComplete,
  takesForStanza,
} from '@/data/store'
import { useBrainStore } from '@/data/useBrainStore'
import { stanzaLabel } from '@/lib/stanza'

export function RecordStanzaPage() {
  const { groupId = '', songId = '', stanzaId = '' } = useParams()
  const state = useBrainStore()
  const profile = currentProfile()!
  const navigate = useNavigate()

  const song = state.songs.find((s) => s.id === songId)
  const stanza = state.stanzas.find((s) => s.id === stanzaId)
  const complete = stanzaComplete(stanzaId)

  const prevStanza = useMemo(() => {
    if (!stanza) return null
    return (
      state.stanzas.find((s) => s.songId === songId && s.index === stanza.index - 1) ?? null
    )
  }, [state.stanzas, songId, stanza])

  const prevTakes = prevStanza ? takesForStanza(prevStanza.id) : []
  const myTakes = takesForStanza(stanzaId)

  const [cuePrev, setCuePrev] = useState(Boolean(prevTakes[0]))
  const [status, setStatus] = useState<'idle' | 'cue' | 'recording' | 'review'>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<RecorderHandle | null>(null)

  if (!song || !stanza || !canAccessSong(songId, profile.id)) {
    return (
      <Page title="Gravar" backTo={`/groups/${groupId}/songs/${songId}/edit`}>
        <div className="empty">Estrofe não encontrada</div>
      </Page>
    )
  }

  if (!complete) {
    return (
      <Page title="Gravar" backTo={`/groups/${groupId}/songs/${songId}/edit`}>
        <div className="empty">Defina todos os versos da estrofe antes de gravar.</div>
      </Page>
    )
  }

  const acceptedText = state.slots
    .filter((s) => s.stanzaId === stanzaId)
    .sort((a, b) => a.index - b.index)
    .map((s) => state.proposals.find((p) => p.id === s.acceptedProposalId)?.text ?? '')
    .join('\n')

  async function startFlow() {
    setError('')
    const ok = await requestMicPermission()
    if (!ok) {
      setError('Permissão de microfone negada')
      return
    }

    try {
      if (cuePrev && prevTakes[0]) {
        setStatus('cue')
        await playDataUrl(prevTakes[0].audioData)
      }
      const rec = await createRecorder()
      recorderRef.current = rec
      rec.start()
      setStatus('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gravar')
      setStatus('idle')
    }
  }

  async function stopRec() {
    const rec = recorderRef.current
    if (!rec) return
    const result = await rec.stop()
    recorderRef.current = null
    setPreviewUrl(result.dataUrl)
    setDurationMs(result.durationMs)
    setStatus('review')
  }

  function save() {
    if (!previewUrl) return
    void saveAudioTake({
      stanzaId,
      userId: profile.id,
      audioData: previewUrl,
      durationMs,
    }).then(() => navigate(`/groups/${groupId}/songs/${songId}/edit`))
  }

  return (
    <Page
      kicker="áudio"
      title={stanzaLabel(stanza)}
      backTo={`/groups/${groupId}/songs/${songId}/edit`}
      narrow
    >
      <pre className="lyrics-block muted">{acceptedText}</pre>

      {prevTakes.length > 0 && (
        <label className="row">
          <input
            type="checkbox"
            checked={cuePrev}
            onChange={(e) => setCuePrev(e.target.checked)}
            disabled={status === 'recording' || status === 'cue'}
          />
          <span>Ouvir estrofe anterior antes de gravar</span>
        </label>
      )}

      {error && <div className="error">{error}</div>}

      <div className="recorder-stage">
        <div className={`pulse ${status === 'recording' ? 'live' : ''}`}>
          {status === 'recording' ? 'REC' : status === 'cue' ? '▶' : 'MIC'}
        </div>
        <p className="muted">
          {status === 'idle' && 'Pronto para gravar'}
          {status === 'cue' && 'Ouvindo estrofe anterior…'}
          {status === 'recording' && 'Gravando — cante a estrofe'}
          {status === 'review' && `Take · ${(durationMs / 1000).toFixed(1)}s`}
        </p>
      </div>

      <div className="stack">
        {status === 'idle' && (
          <button type="button" className="btn block" onClick={() => void startFlow()}>
            {cuePrev && prevTakes[0] ? 'Ouvir anterior e gravar' : 'Começar gravação'}
          </button>
        )}
        {status === 'recording' && (
          <button type="button" className="btn danger block" onClick={() => void stopRec()}>
            Parar
          </button>
        )}
        {status === 'review' && previewUrl && (
          <>
            <audio controls src={previewUrl} style={{ width: '100%' }} />
            <button type="button" className="btn block" onClick={save}>
              Salvar take
            </button>
            <button
              type="button"
              className="btn secondary block"
              onClick={() => {
                setPreviewUrl(null)
                setStatus('idle')
              }}
            >
              Descartar e gravar de novo
            </button>
          </>
        )}
      </div>

      {myTakes.length > 0 && (
        <div className="stack">
          <h2 className="sheet-title">Takes desta estrofe</h2>
          {myTakes.map((t) => {
            const author = state.profiles.find((p) => p.id === t.userId)
            return (
              <div key={t.id} className="list-item stack">
                <div className="row spread">
                  <strong>{author?.name}</strong>
                  <span className="muted">{(t.durationMs / 1000).toFixed(1)}s</span>
                </div>
                <audio controls src={t.audioData} style={{ width: '100%' }} />
              </div>
            )
          })}
        </div>
      )}
    </Page>
  )
}
