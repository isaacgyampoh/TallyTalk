import { describe, expect, it } from 'vitest'
import { pickMimeType, recordingFileName, RecorderUnavailable, startRecording } from './recorder'

describe('recordingFileName', () => {
  it('matches the extension to the container actually recorded', () => {
    expect(recordingFileName('audio/webm;codecs=opus')).toBe('voice-note.webm')
    expect(recordingFileName('audio/mp4')).toBe('voice-note.m4a')
    expect(recordingFileName('audio/ogg')).toBe('voice-note.ogg')
  })

  it('falls back to webm for an unfamiliar type', () => {
    expect(recordingFileName('audio/x-weird')).toBe('voice-note.webm')
  })
})

describe('pickMimeType', () => {
  it('returns undefined where MediaRecorder does not exist, rather than throwing', () => {
    // Node has no MediaRecorder; the caller must cope with that.
    expect(pickMimeType()).toBeUndefined()
  })
})

describe('startRecording', () => {
  it('reports "unsupported" instead of throwing something unhandleable', async () => {
    await expect(startRecording()).rejects.toBeInstanceOf(RecorderUnavailable)
    await expect(startRecording()).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
