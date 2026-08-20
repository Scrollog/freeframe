const STORAGE_KEY = 'ff_guest_comment_tokens'

type TokenMap = Record<string, string>

function readTokens(): TokenMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as TokenMap
  } catch {
    return {}
  }
}

function key(shareToken: string, commentId: string) {
  return `${shareToken}:${commentId}`
}

export function getGuestCommentToken(shareToken: string, commentId: string) {
  return readTokens()[key(shareToken, commentId)] ?? null
}

export function storeGuestCommentToken(shareToken: string, commentId: string, token: string) {
  if (typeof window === 'undefined') return
  const tokens = readTokens()
  tokens[key(shareToken, commentId)] = token
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function removeGuestCommentToken(shareToken: string, commentId: string) {
  if (typeof window === 'undefined') return
  const tokens = readTokens()
  delete tokens[key(shareToken, commentId)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}
