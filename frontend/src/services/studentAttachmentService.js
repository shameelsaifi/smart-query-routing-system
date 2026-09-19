import { ApiError, apiRequest } from './apiClient'
import { getStudentDraft } from './studentDraftService'

export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg'
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

const MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const STATES = ['PENDING', 'READY', 'REMOVING']
const TICKET_STATES = [
  'DRAFT', 'PENDING', 'CLASSIFIED', 'ROUTED', 'IN_PROGRESS',
  'NEEDS_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED',
]
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const validRevision = (value) => Number.isInteger(value) && value >= 1
const basePath = (number) => '/tickets/' + encodeURIComponent(number) + '/attachments'

function validAttachment(item) {
  return item && UUID_PATTERN.test(item.attachment_id)
    && typeof item.file_name === 'string' && item.file_name.length > 0
    && MIME_TYPES.includes(item.mime_type)
    && Number.isInteger(item.file_size)
    && item.file_size >= 1 && item.file_size <= MAX_ATTACHMENT_BYTES
    && STATES.includes(item.upload_state)
}

async function attachmentRequest(path, options = {}) {
  const { signal, timeoutMs = 15000, ...requestOptions } = options
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()

  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })

  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await apiRequest(path, {
      ...requestOptions, signal: controller.signal, cache: 'no-store',
    })
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        'The attachment request timed out. Check its status before retrying.',
        408, null, { cause: error },
      )
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function validateSelectedFile(file) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Select a non-empty file.')
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Each attachment must be 5 MB or smaller.')
  }
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name.trim())) {
    throw new Error('Only PDF, PNG, JPG and JPEG files are allowed.')
  }
}

export async function getTicketAttachments(accessToken, ticketNumber, signal) {
  const data = await attachmentRequest(basePath(ticketNumber), {
    accessToken, signal,
    errorMessage: 'Attachments could not be loaded.',
  })
  if (
    data?.ticket_number !== ticketNumber
    || !TICKET_STATES.includes(data.ticket_status)
    || !validRevision(data.draft_revision)
    || !Number.isInteger(data.max_files) || data.max_files < 1
    || !Array.isArray(data.items) || !data.items.every(validAttachment)
  ) throw new ApiError('Attachments returned an unexpected response.', 502)

  return data
}

export async function getDraftAttachmentWorkspace(accessToken, ticketNumber, signal) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [draft, attachments] = await Promise.all([
      getStudentDraft(accessToken, ticketNumber, signal),
      getTicketAttachments(accessToken, ticketNumber, signal),
    ])
    if (
      draft.draft_revision === attachments.draft_revision
      && draft.status === attachments.ticket_status
    ) return { draft, attachments }
  }

  throw new ApiError(
    'This draft changed while loading. Please reload it.',
    409,
  )
}

export async function uploadTicketAttachment(
  accessToken, ticketNumber, selection, expectedRevision, signal,
) {
  validateSelectedFile(selection.file)
  const form = new FormData()
  form.append('file', selection.file)
  const query = new URLSearchParams({ expected_revision: String(expectedRevision) })

  const data = await attachmentRequest(
    basePath(ticketNumber) + '/' + encodeURIComponent(selection.id) + '?' + query,
    {
      method: 'PUT', accessToken, signal, body: form, timeoutMs: 120000,
      errorMessage: 'The attachment could not be uploaded.',
    },
  )

  if (
    !validAttachment(data?.attachment)
    || data.attachment.attachment_id !== selection.id
    || data.attachment.upload_state !== 'READY'
    || !validRevision(data.draft_revision)
  ) throw new ApiError('The upload could not be confirmed. Check its status.', 502)

  return data
}

export async function removeTicketAttachment(
  accessToken, ticketNumber, attachmentId, expectedRevision, signal,
) {
  const query = new URLSearchParams({ expected_revision: String(expectedRevision) })
  const data = await attachmentRequest(
    basePath(ticketNumber) + '/' + encodeURIComponent(attachmentId) + '?' + query,
    {
      method: 'DELETE', accessToken, signal, timeoutMs: 120000,
      errorMessage: 'The attachment could not be removed.',
    },
  )
  if (
    data?.attachment_id !== attachmentId || data.removed !== true
    || !validRevision(data.draft_revision)
  ) throw new ApiError('Removal could not be confirmed. Check its status.', 502)

  return data
}

export async function downloadTicketAttachment(
  accessToken, ticketNumber, attachment, signal,
) {
  const blob = await attachmentRequest(
    basePath(ticketNumber) + '/' + encodeURIComponent(attachment.attachment_id) + '/download',
    {
      accessToken, signal, responseType: 'blob', timeoutMs: 60000,
      errorMessage: 'The attachment could not be downloaded.',
    },
  )
  if (
    !(blob instanceof Blob) || blob.size !== attachment.file_size
    || blob.type.split(';')[0] !== attachment.mime_type
  ) throw new ApiError('The download returned an unexpected file.', 502)

  return blob
}

export function saveAttachmentDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}