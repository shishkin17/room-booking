import { ApiError, type ApiErrorBody, type ApiErrorCode } from './errors'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

const CODES: readonly ApiErrorCode[] = [
  'VALIDATION',
  'CONFLICT',
  'NOT_FOUND',
  'INTERNAL',
  'NETWORK',
]

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const { code, message } = value as Record<string, unknown>
  return (
    typeof message === 'string' && typeof code === 'string' && CODES.includes(code as ApiErrorCode)
  )
}

const GENERIC_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз позже.'

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 409) return 'CONFLICT'
  if (status === 404) return 'NOT_FOUND'
  if (status === 400 || status === 422) return 'VALIDATION'
  return 'INTERNAL'
}

function isObjectWithMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).message === 'string'
  )
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, {
      code: 'NETWORK',
      message: 'Не удалось связаться с сервером. Проверьте подключение.',
    })
  }

  if (!response.ok) {
    const body = await parseJson(response)
    if (isErrorBody(body)) throw new ApiError(response.status, body)
    // A backend with a different error shape still gets the right UX (e.g. 409 handling).
    throw new ApiError(response.status, {
      code: codeFromStatus(response.status),
      message: isObjectWithMessage(body) ? body.message : GENERIC_MESSAGE,
    })
  }

  if (response.status === 204) return undefined as T
  const body = await parseJson(response)
  if (body === undefined) {
    // e.g. an SPA fallback returning index.html instead of JSON
    throw new ApiError(response.status, { code: 'INTERNAL', message: GENERIC_MESSAGE })
  }
  return body as T
}
