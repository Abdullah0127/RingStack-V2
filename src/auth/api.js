export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    console.error('[api] Request could not reach the service', {
      method,
      path: path.split('?')[0],
      cause: error instanceof Error ? error.message : String(error),
    })
    throw new ApiError(0, 'network_error', 'Check your internet connection.')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType.trim())) {
    let responsePreview = ''
    try {
      responsePreview = (await response.text()).slice(0, 160)
    } catch (error) {
      console.error('[api] Could not read a non-JSON response body', {
        method,
        path: path.split('?')[0],
        status: response.status,
        cause: error instanceof Error ? error.message : String(error),
      })
    }
    console.error('[api] Service returned a non-JSON response', {
      method,
      path: path.split('?')[0],
      status: response.status,
      contentType,
      responsePreview,
    })
    throw new ApiError(response.status, 'invalid_response', 'The service returned an unexpected response.')
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    console.error('[api] Service returned invalid JSON', {
      method,
      path: path.split('?')[0],
      status: response.status,
      cause: error instanceof Error ? error.message : String(error),
    })
    throw new ApiError(response.status, 'invalid_response', 'The service returned an unexpected response.')
  }
  if (!response.ok) {
    const errorCode = payload && typeof payload === 'object' && typeof payload.error === 'string'
      ? payload.error
      : 'request_failed'
    const errorMessage = payload && typeof payload === 'object' && typeof payload.message === 'string'
      ? payload.message
      : 'We could not complete that request.'
    console.error('[api] Request returned an error response', {
      method,
      path: path.split('?')[0],
      status: response.status,
      code: errorCode,
    })
    throw new ApiError(response.status, errorCode, errorMessage)
  }
  return payload
}
