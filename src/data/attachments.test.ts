import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'
const TASK = 'task-uuid'

let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const { listTaskAttachments, uploadTaskAttachment, signedAttachmentUrl, kindFor } =
  await import('./attachments')

const fileOf = (name: string, type: string, size = 1024) =>
  ({ name, type, size }) as unknown as File

beforeEach(() => {
  client = makeSupabaseMock({ results: { task_attachments: { data: [], error: null } } })
})

describe('kindFor', () => {
  it('maps mime types onto the three kinds the schema allows', () => {
    expect(kindFor('image/png')).toBe('image')
    expect(kindFor('audio/webm')).toBe('audio')
    expect(kindFor('application/pdf')).toBe('document')
  })

  it('treats anything unrecognised as a document rather than failing', () => {
    expect(kindFor('')).toBe('document')
    expect(kindFor('application/x-made-up')).toBe('document')
  })
})

describe('uploadTaskAttachment', () => {
  it('stores under the task id, which is what the storage policy checks', async () => {
    await uploadTaskAttachment(TASK, fileOf('scan.pdf', 'application/pdf'))
    expect(client.uploads[0].bucket).toBe('attachments')
    // 0003 reads the task id out of the first path segment.
    expect(client.uploads[0].path.startsWith(`${TASK}/`)).toBe(true)
  })

  it('keeps names unique within the task, so two people can attach scan.pdf', async () => {
    await uploadTaskAttachment(TASK, fileOf('scan.pdf', 'application/pdf'))
    const first = client.uploads[0].path
    client = makeSupabaseMock({ results: { task_attachments: { error: null } } })
    await uploadTaskAttachment(TASK, fileOf('scan.pdf', 'application/pdf'))
    expect(client.uploads[0].path).not.toBe(first)
  })

  it('sanitises the file name rather than trusting it in a path', async () => {
    await uploadTaskAttachment(TASK, fileOf('../../etc/passwd', 'application/pdf'))
    expect(client.uploads[0].path).not.toContain('..')
    expect(client.uploads[0].path).not.toContain('/etc/')
  })

  it('records the row with the uploader, kind and size', async () => {
    await uploadTaskAttachment(TASK, fileOf('photo.png', 'image/png', 4096))
    expect(client.argFor('task_attachments', 'insert')).toMatchObject({
      task_id: TASK,
      uploaded_by: ME,
      attachment_type: 'image',
      file_name: 'photo.png',
      file_size: 4096,
    })
  })

  it('does not record a row when the upload was refused', async () => {
    // Otherwise the task would list a file that does not exist.
    client = makeSupabaseMock({ uploadError: { message: 'denied' } })
    await expect(
      uploadTaskAttachment(TASK, fileOf('scan.pdf', 'application/pdf')),
    ).rejects.toMatchObject({ message: 'denied' })
    expect(client.calls.task_attachments).toBeUndefined()
  })
})

describe('listTaskAttachments', () => {
  it('reads one task, oldest first', async () => {
    await listTaskAttachments(TASK)
    expect(client.calls.task_attachments.find((c) => c.method === 'eq')?.args).toEqual([
      'task_id',
      TASK,
    ])
    expect(client.calls.task_attachments.find((c) => c.method === 'order')?.args[1]).toEqual({
      ascending: true,
    })
  })
})

describe('signedAttachmentUrl', () => {
  it('signs a private file for a short window', async () => {
    const url = await signedAttachmentUrl(`${TASK}/scan.pdf`, 120)
    expect(url).toContain('/signed/attachments/')
    expect(url).toContain('exp=120')
  })

  it('returns null rather than throwing when it cannot be signed', async () => {
    // A broken preview link should degrade quietly, not take the screen down.
    client = makeSupabaseMock({ uploadError: { message: 'nope' } })
    expect(await signedAttachmentUrl('x/y.pdf')).toBeNull()
  })
})
