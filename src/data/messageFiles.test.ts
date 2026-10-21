import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSupabaseMock, type MockClient } from './supabaseMock'

const ME = 'me-uuid'
const THEM = 'them-uuid'
const PERSON = { kind: 'person' as const, id: THEM }
let client: MockClient
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return client
  },
  isSupabaseConfigured: true,
}))

const { fileProblem, listAttachmentsFor, readableSize, sendFileMessage, signedFileUrl } =
  await import('./messageFiles')

function fakeFile(over: Partial<{ name: string; type: string; size: number }> = {}) {
  return {
    name: 'invoice.pdf',
    type: 'application/pdf',
    size: 20_000,
    ...over,
  } as unknown as File
}

beforeEach(() => {
  client = makeSupabaseMock({
    results: {
      messages: { data: { id: 'msg-1' }, error: null },
      message_attachments: { error: null },
    },
  })
})

describe('fileProblem', () => {
  it('accepts the documents this app is for', () => {
    expect(fileProblem(fakeFile())).toBeNull()
    expect(fileProblem(fakeFile({ type: 'image/jpeg' }))).toBeNull()
    expect(
      fileProblem(
        fakeFile({
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      ),
    ).toBeNull()
  })

  it('refuses anything over the plan’s limit', () => {
    // 10 MB a file is about a hundred files inside Supabase Free's 1 GB.
    expect(fileProblem(fakeFile({ size: 11 * 1024 * 1024 }))).toMatch(/larger than 10 MB/)
  })

  it('refuses an empty file', () => {
    expect(fileProblem(fakeFile({ size: 0 }))).toMatch(/empty/)
  })

  it('refuses a type the bucket does not allow, whatever it is called', () => {
    expect(fileProblem(fakeFile({ name: 'safe.pdf', type: 'application/x-msdownload' }))).toMatch(
      /cannot be sent/,
    )
  })
})

describe('readableSize', () => {
  it('reads like a file manager', () => {
    expect(readableSize(512)).toBe('512 B')
    expect(readableSize(20_000)).toBe('20 KB')
    expect(readableSize(3_500_000)).toBe('3.3 MB')
  })
})

describe('sendFileMessage', () => {
  it('uploads into my own folder, which is what the write policy checks', async () => {
    await sendFileMessage(PERSON, fakeFile())
    expect(client.uploads[0].bucket).toBe('message-files')
    expect(client.uploads[0].path.startsWith(`${ME}/`)).toBe(true)
  })

  it('cannot be tricked into escaping that folder by the file name', async () => {
    await sendFileMessage(PERSON, fakeFile({ name: '../../etc/passwd' }))
    const path = client.uploads[0].path
    expect(path.startsWith(`${ME}/`)).toBe(true)
    expect(path).not.toContain('..')
  })

  it('sends the message and records the attachment against it', async () => {
    await sendFileMessage(PERSON, fakeFile(), 'The invoice')
    expect(client.argFor('messages', 'insert')).toMatchObject({
      sender_id: ME,
      recipient_id: THEM,
      group_id: null,
      body: 'The invoice',
    })
    expect(client.argFor('message_attachments', 'insert')).toMatchObject({
      message_id: 'msg-1',
      uploaded_by: ME,
      file_name: 'invoice.pdf',
      mime_type: 'application/pdf',
      file_size: 20_000,
    })
  })

  it('refuses before uploading anything when the file is not allowed', async () => {
    await expect(sendFileMessage(PERSON, fakeFile({ size: 20 * 1024 * 1024 }))).rejects.toThrow(
      /10 MB/,
    )
    expect(client.uploads).toHaveLength(0)
  })

  it('removes the upload again when the message cannot be sent', async () => {
    // Otherwise a blocked sender would leave files paying for storage forever.
    client = makeSupabaseMock({
      results: { messages: { error: { message: 'blocked' } } },
    })
    await expect(sendFileMessage(PERSON, fakeFile())).rejects.toMatchObject({ message: 'blocked' })
    expect(client.removals).toHaveLength(1)
  })
})

describe('listAttachmentsFor', () => {
  it('asks once for the whole page, not once per message', async () => {
    client = makeSupabaseMock({ results: { message_attachments: { data: [], error: null } } })
    await listAttachmentsFor(['m1', 'm2', 'm3'])
    expect(client.calls.message_attachments.find((c) => c.method === 'in')?.args).toEqual([
      'message_id',
      ['m1', 'm2', 'm3'],
    ])
  })

  it('does not ask at all for an empty page', async () => {
    client = makeSupabaseMock({})
    expect(await listAttachmentsFor([])).toEqual([])
    expect(client.calls.message_attachments).toBeUndefined()
  })
})

describe('signedFileUrl', () => {
  it('signs for a short window, since the bucket is private', async () => {
    const url = await signedFileUrl('me-uuid/abc/invoice.pdf')
    expect(url).toContain('/signed/message-files/')
    expect(url).toContain('exp=300')
  })

  it('returns null rather than throwing when it cannot be signed', async () => {
    client = makeSupabaseMock({ uploadError: { message: 'nope' } })
    expect(await signedFileUrl('x/y.pdf')).toBeNull()
  })
})
