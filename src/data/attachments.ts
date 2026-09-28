import { supabase } from '@/lib/supabase'

/**
 * Files on a task — documents, images, and voice notes.
 *
 * Everything goes to `attachments/<task id>/…`. That is not a naming
 * preference: migration 0003 reads the task id out of the first path segment
 * and checks `can_access_task` against it, so a file stored anywhere else is
 * unreadable by everyone, including whoever uploaded it.
 *
 * The bucket is private, so reading needs a signed URL rather than a public one.
 */

function db() {
  if (!supabase) throw new Error('Supabase client unavailable (running in preview mode)')
  return supabase
}

async function myId(): Promise<string> {
  const {
    data: { user },
  } = await db().auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user.id
}

export type AttachmentKind = 'document' | 'image' | 'audio'

export interface AttachmentRow {
  id: string
  task_id: string
  uploaded_by: string
  storage_path: string
  attachment_type: AttachmentKind
  file_name: string | null
  file_size: number | null
  created_at: string
}

export const attachmentsKey = (taskId: string) => ['task-attachments', taskId] as const

/** How the app groups a MIME type. Anything unrecognised is a document. */
export function kindFor(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

/**
 * A storage key that is safe and unique.
 *
 * The uploader chooses the file name, so it is never trusted directly in a
 * path: separators and oddities collapse to underscores, dot runs collapse to a
 * single dot, and leading dots go, which is what stops "../../etc/passwd"
 * surviving as something containing "..". A random suffix rides alongside the
 * timestamp because two people can attach within the same millisecond.
 */
function storageName(original: string): string {
  const safe =
    original
      .replace(/[^\w.-]+/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+/, '')
      .slice(-80) || 'file'
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${unique}-${safe}`
}

export async function listTaskAttachments(taskId: string): Promise<AttachmentRow[]> {
  const { data, error } = await db()
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AttachmentRow[]
}

/**
 * Put a file on a task and record it.
 *
 * The upload happens first: if the storage write is refused there must be no
 * row pointing at a file that does not exist.
 */
export async function uploadTaskAttachment(taskId: string, file: File): Promise<void> {
  const me = await myId()
  const path = `${taskId}/${storageName(file.name)}`

  const { error: upErr } = await db()
    .storage.from('attachments')
    .upload(path, file, { contentType: file.type })
  if (upErr) throw upErr

  const { error } = await db()
    .from('task_attachments')
    .insert({
      task_id: taskId,
      uploaded_by: me,
      storage_path: path,
      attachment_type: kindFor(file.type),
      file_name: file.name,
      file_size: file.size,
    })
  if (error) throw error
}

/** A short-lived URL for a private file. Null when it cannot be signed. */
export async function signedAttachmentUrl(path: string, seconds = 300): Promise<string | null> {
  const { data, error } = await db().storage.from('attachments').createSignedUrl(path, seconds)
  if (error) return null
  return data?.signedUrl ?? null
}
