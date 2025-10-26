// Lightweight auth helpers: check JWT expiry and attempt a silent refresh
export function isTokenExpired(token) {
  if (!token) return true
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload || !payload.exp) return true
    const now = Math.floor(Date.now() / 1000)
    return payload.exp < now
  } catch (e) {
    // If token can't be parsed, treat as expired
    console.warn('isTokenExpired: failed to parse token', e)
    return true
  }
}

// Try to silently refresh an access token using Google Identity Services token client
// Returns a new token string on success, or null on failure/unavailable
export function tryRefreshToken() {
  return new Promise((resolve) => {
    try {
      // Ensure the Google Identity API is available
      const g = window.google
      if (!g || !g.accounts || !g.accounts.oauth2 || !g.accounts.oauth2.initTokenClient) {
        return resolve(null)
      }

      const client = g.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (resp) => {
          // resp contains access_token on success
          if (resp && resp.access_token) {
            try {
              localStorage.setItem('google_access_token', resp.access_token)
            } catch (e) {
              console.warn('tryRefreshToken: failed to store token', e)
            }
            return resolve(resp.access_token)
          }
          resolve(null)
        }
      })

      // Request an access token silently (no UI)
      client.requestAccessToken({ prompt: '' })
      // Note: callback will resolve
    } catch (e) {
      console.warn('tryRefreshToken error', e)
      resolve(null)
    }
  })
}

// Ensure we have a valid token: returns token string or null. If expired and refresh not possible,
// dispatches a global 'session-expired' event so the app can show a modal.
export async function ensureValidToken() {
  try {
    const token = localStorage.getItem('google_access_token')
    if (!token) return null
    if (!isTokenExpired(token)) return token

    // Try refresh
    const refreshed = await tryRefreshToken()
    if (refreshed) return refreshed

    // Notify app that session expired
    try {
      window.dispatchEvent(new CustomEvent('session-expired'))
    } catch (e) {
      console.warn('ensureValidToken: failed to dispatch session-expired', e)
    }
    return null
  } catch (e) {
    console.warn('ensureValidToken error', e)
    return null
  }
}

export default {
  isTokenExpired,
  tryRefreshToken,
  ensureValidToken
}
