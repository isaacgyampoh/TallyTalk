import { supabase } from '@/lib/supabase'
import { messageRow, type Target } from './messages'

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
  thumbnail_path: string | null
  width: number | null
  height: number | null
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
export async function sendFileMessage(target: Target, file: File, note = ''): Promise<void> {
  const problem = fileProblem(file)
  if (problem) throw new Error(problem)

  const me = await myId()
  const path = storagePath(me, file.name)

  const { error: upErr } = await db()
    .storage.from('message-files')
    .upload(path, file, { contentType: file.type })
  if (upErr) throw upErr

  // An image gets a small preview beside it, so a conversation never has to
  // download a full-resolution photograph to show one. Made in the browser:
  // server-side image processing would mean another service to pay for.
  const thumb = isImage(file.type) ? await uploadThumbnail(path, file).catch(() => null) : null

  try {
    const { data: message, error: msgErr } = await db()
      .from('messages')
      .insert(messageRow(me, target, note.trim()))
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
        thumbnail_path: thumb?.path ?? null,
        width: thumb?.width ?? null,
        height: thumb?.height ?? null,
      })
    if (attErr) throw attErr
  } catch (err) {
    const orphans = thumb ? [path, thumb.path] : [path]
    await db()
      .storage.from('message-files')
      .remove(orphans)
      .catch(() => {
        /* the upload is orphaned; it is readable only by its uploader */
      })
    throw err
  }
}

export function isImage(mime: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'].includes(mime)
}

/** The longest edge of a preview. Enough for a conversation, no more. */
export const THUMB_MAX_EDGE = 480

/**
 * Draw the image down to a small WebP and upload it beside the original.
 *
 * Returns null when the browser cannot do it — an old WebView, a format it
 * will not decode, a corrupt file. The message still sends; it simply shows a
 * file card instead of a preview.
 */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.72),
    )
  } catch {
    return null
  }
}

async function uploadThumbnail(
  originalPath: string,
  file: File,
): Promise<{ path: string; width: number; height: number } | null> {
  const blob = await makeThumbnail(file)
  if (!blob) return null
  const bitmap = await createImageBitmap(file).catch(() => null)
  const path = `${originalPath}.thumb.webp`
  const { error } = await db()
    .storage.from('message-files')
    .upload(path, blob, { contentType: 'image/webp' })
  if (error) return null
  const result = { path, width: bitmap?.width ?? 0, height: bitmap?.height ?? 0 }
  bitmap?.close?.()
  return result
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
