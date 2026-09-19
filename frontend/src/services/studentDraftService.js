import { apiRequest } from './apiClient'

const TICKET_STATUSES = new Set([
  'DRAFT',
  'PENDING',
  'CLASSIFIED',
  'ROUTED',
  'IN_PROGRESS',
  'NEEDS_INFORMATION',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
])

async function draftRequest(
  path,
  options = {},
) {
  const {
    signal,
    timeoutMs: customTimeoutMs,
    ...requestOptions
  } = options

  if (signal?.aborted) {
    throw new DOMException(
      'Request cancelled.',
      'AbortError',
    )
  }

  const controller =
    new AbortController()

  const cancel = () =>
    controller.abort()

  signal?.addEventListener(
    'abort',
    cancel,
    {
      once: true,
    },
  )

  const timeoutMs =
    customTimeoutMs
    ?? (
      options.method
      && options.method !== 'GET'
        ? 30000
        : 15000
    )

  const timeout =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs,
    )

  try {
    return await apiRequest(
      path,
      {
        ...requestOptions,

        signal:
          controller.signal,

        cache:
          'no-store',
      },
    )

  } catch (error) {
    if (
      controller.signal.aborted
      && !signal?.aborted
    ) {
      throw new Error(
        'Request timed out. Please retry.',
        {
          cause: error,
        },
      )
    }

    throw error

  } finally {
    window.clearTimeout(
      timeout
    )

    signal?.removeEventListener(
      'abort',
      cancel,
    )
  }
}


function validateDraft(
  data,
  ticketNumber = null,
) {
  if (
    typeof data?.ticket_number
      !== 'string'

    || !data.ticket_number

    || (
      ticketNumber !== null
      && data.ticket_number
        !== ticketNumber
    )

    || typeof data.ticket_id
      !== 'string'

    || typeof data.subject
      !== 'string'

    || typeof data.message
      !== 'string'

    || data.source !== 'WEB'

    || !TICKET_STATUSES.has(
      data.status
    )

    || !Number.isInteger(
      data.draft_revision
    )

    || data.draft_revision < 1
  ) {
    throw new Error(
      'Draft request returned an unexpected response.'
    )
  }

  return data
}


function validateGuidance(data) {
  if (
    typeof data?.improved_subject
      !== 'string'

    || !data.improved_subject

    || typeof data.improved_message
      !== 'string'

    || !data.improved_message

    || typeof data.likely_category
      !== 'string'

    || typeof data.likely_destination
      !== 'string'

    || !Array.isArray(
      data.missing_information
    )

    || !data.missing_information.every(
      (item) =>
        typeof item === 'string'
    )

    || typeof data.guidance_note
      !== 'string'

    || typeof data.confidence_score
      !== 'number'

    || data.confidence_score < 0

    || data.confidence_score > 1
  ) {
    throw new Error(
      'AI guidance returned an unexpected response.'
    )
  }

  return data
}


export async function getStudentGuidance(
  accessToken,
  payload,
  signal,
) {
  const data = await draftRequest(
    '/tickets/drafts/guidance',
    {
      method: 'POST',

      accessToken,

      body: payload,

      signal,

      timeoutMs: 75000,

      errorMessage:
        'AI guidance could not be generated. Please try again.',
    },
  )

  return validateGuidance(
    data
  )
}


export async function createStudentDraft(
  accessToken,
  payload,
) {
  const data = await draftRequest(
    '/tickets/drafts',
    {
      method: 'POST',

      accessToken,

      body: payload,

      errorMessage:
        'Draft save could not be confirmed. Please retry.',
    },
  )

  return validateDraft(
    data
  )
}


export async function getStudentDraft(
  accessToken,
  ticketNumber,
  signal,
) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(
      ticketNumber
    )}`,
    {
      accessToken,

      signal,

      errorMessage:
        'Draft could not be loaded. Please try again.',
    },
  )

  return validateDraft(
    data,
    ticketNumber,
  )
}


export async function updateStudentDraft(
  accessToken,
  ticketNumber,
  payload,
  signal,
) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(
      ticketNumber
    )}`,
    {
      method: 'PATCH',

      accessToken,

      body: payload,

      signal,

      errorMessage:
        'Draft changes could not be saved. Please retry.',
    },
  )

  return validateDraft(
    data,
    ticketNumber,
  )
}


export async function submitStudentDraft(
  accessToken,
  ticketNumber,
  payload,
  signal,
) {
  const data = await draftRequest(
    `/tickets/drafts/${encodeURIComponent(
      ticketNumber
    )}/submit`,
    {
      method: 'POST',

      accessToken,

      body: payload,

      signal,

      errorMessage:
        'Draft submission could not be confirmed. Please retry.',
    },
  )

  if (
    data?.ticket?.ticket_number
      !== ticketNumber

    || typeof data.submitted_now
      !== 'boolean'

    || !TICKET_STATUSES.has(
      data.ticket.status
    )

    || data.ticket.status === 'DRAFT'
  ) {
    throw new Error(
      'Draft submission returned an unexpected response.'
    )
  }

  return data
}