/**
 * Microphone capture for voice notes.
 *
 * Wraps MediaRecorder so callers deal in start/stop and a Blob, and so the
 * failure that actually happens in the field — a refused permission — comes
 * back as something a screen can explain rather than an unhandled rejection.
 */

export type RecorderError = 'denied' | 'unsupported' | 'failed'

export class RecorderUnavailable extends Error {
  constructor(public readonly reason: RecorderError) {
    super(reason)
    this.name = 'RecorderUnavailable'
  }
}

/** The best container this browser will actually produce. */
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  // Safari records mp4; Chrome and Firefox prefer webm/opus.
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(type)) return type
  }
  return undefined
}

export interface ActiveRecording {
  /** Resolves with the recorded audio, or null if it was cancelled. */
  stop: (keep: boolean) => Promise<Blob | null>
}

export async function startRecording(): Promise<ActiveRecording> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new RecorderUnavailable('unsupported')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new RecorderUnavailable('unsupported')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err) {
    // NotAllowedError is a refusal; everything else is a device problem.
    const name = (err as { name?: string })?.name
    throw new RecorderUnavailable(name === 'NotAllowedError' ? 'denied' : 'failed')
  }

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start()

  return {
    stop: (keep: boolean) =>
      new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          // Always release the microphone, kept or not — leaving the stream open
          // keeps the browser's recording indicator on.
          stream.getTracks().forEach((t) => t.stop())
          resolve(keep && chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null)
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else recorder.onstop?.(new Event('stop'))
      }),
  }
}

/** A filename for an uploaded recording, matching the container it was made in. */
export function recordingFileName(mimeType: string): string {
  const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
  return `voice-note.${ext}`
}
