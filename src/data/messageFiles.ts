import { supabase } from '@/lib/supabase'

/**
 * Files sent inside a conversation.
 *
 * The bucket is private and enforces the size and type limits itself, so the
 * checks here are for a fast, clear error rather than for safety — a client
 * that skipped them would simply be refused by the storage service.
 *
 * Sizes are chosen for Supabase Free: 1 GB of storage total, so 10 MB a file
 * is about a hundred documents. Deliberately too small for video.
 */

function db() {
  if (!supabase) throw new Error('Not connected to the server')
  return supabase
}

async function myId(): Promise<string> {
  const {
    data: { user },
  } = await db().auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user.id
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** What the bucket accepts. Kept in step with migration 0012. */
export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]

export interface MessageAttachment {
  id: string
  message_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  created_at: string
}

/** Why this file cannot be sent, or null. */
export function fileProblem(file: { type: string; size: number }): string | null {
  if (file.size > MAX_FILE_BYTES) return 'That file is larger than 10 MB.'
  if (file.size === 0) return 'That file is empty.'
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'That kind of file cannot be sent — documents, spreadsheets and images only.'
  }
  return null
}

/** Human size, for the file card. */
export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * A storage path that cannot escape its folder or collide.
 *
 * The leading segment is the uploader's own id, which is what the write policy
 * checks: a file can be uploaded before any row exists to point at it.
 */
function storagePath(me: string, original: string): string {
  const safe =
    original
      .replace(/[^\w.-]+/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+/, '')
      .slice(-80) || 'file'
  return `${me}/${crypto.randomUUID()}/${safe}`
}

/**
 * Send a file, with an optional note.
 *
 * Order matters: the file goes up first, because a message pointing at a file
 * that failed to upload is worse than an upload nobody has attached. If
 * anything after the upload fails, the file is removed again rather than left
 * paying for storage forever.
 */
export async function sendFileMessage(contactId: string, file: File, note = ''): Promise<void> {
  const problem = fileProblem(file)
  if (problem) throw new Error(problem)

  const me = await myId()
  const path = storagePath(me, file.name)

  const { error: upErr } = await db()
    .storage.from('message-files')
    .upload(path, file, { contentType: file.type })
  if (upErr) throw upErr

  try {
    const { data: message, error: msgErr } = await db()
      .from('messages')
      .insert({ sender_id: me, recipient_id: contactId, body: note.trim() })
      .select('id')
      .single()
    if (msgErr) throw msgErr

    const { error: attErr } = await db()
      .from('message_attachments')
      .insert({
        message_id: (message as { id: string }).id,
        uploaded_by: me,
        storage_path: path,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        file_size: file.size,
      })
    if (attErr) throw attErr
  } catch (err) {
    await db()
      .storage.from('message-files')
      .remove([path])
      .catch(() => {
        /* the upload is orphaned; it is readable only by its uploader */
      })
    throw err
  }
}

/** The attachments for a page of messages, in one query rather than per row. */
export async function listAttachmentsFor(messageIds: string[]): Promise<MessageAttachment[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await db()
    .from('message_attachments')
    .select('*')
    .in('message_id', messageIds)
  if (error) throw error
  return (data ?? []) as MessageAttachment[]
}

/**
 * A short-lived URL for a private file. Null when it cannot be signed, so a
 * broken link degrades to a disabled button rather than taking the screen down.
 */
export async function signedFileUrl(path: string, seconds = 300): Promise<string | null> {
  const { data, error } = await db().storage.from('message-files').createSignedUrl(path, seconds)
  if (error) return null
  return data?.signedUrl ?? null
}
