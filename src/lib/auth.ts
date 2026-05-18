'use client'

const AUTH_KEY = 'gb_pericias_auth'
const PIN_KEY = 'gb_pericias_pin'
const SESSION_TTL = 8 * 60 * 60 * 1000 // 8 hours

const DEFAULT_PIN_HASH = '7611f1a57f80b0a87b4178e2e5f16bafa30dd0d9947d99f953c091d8c96abd0e' // SHA-256 of "1311"

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPin(pin: string): Promise<string> {
  return sha256(pin)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_KEY) || DEFAULT_PIN_HASH
  const hashed = await sha256(pin)
  return hashed === stored
}

export async function changePin(newPin: string): Promise<void> {
  const hashed = await sha256(newPin)
  localStorage.setItem(PIN_KEY, hashed)
}

export function createSession(): void {
  const expires = Date.now() + SESSION_TTL
  localStorage.setItem(AUTH_KEY, JSON.stringify({ expires }))
}

export function isAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return false
    const { expires } = JSON.parse(raw)
    return Date.now() < expires
  } catch {
    return false
  }
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY)
}

export function isDefaultPin(): boolean {
  const stored = localStorage.getItem(PIN_KEY)
  return !stored
}
