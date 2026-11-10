const STORAGE_PREFIX = 'align.settings-pin.v1.'
const ITERATIONS = 100_000

interface StoredPin {
  salt: string
  hash: string
}

function key(uid: string) {
  return `${STORAGE_PREFIX}${uid}`
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

function decode(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function hashPin(pin: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt).buffer, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256)
  return encode(new Uint8Array(bits))
}

export function hasSettingsPin(uid: string) {
  return localStorage.getItem(key(uid)) !== null
}

export async function saveSettingsPin(uid: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Choose a four-digit PIN.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const stored: StoredPin = { salt: encode(salt), hash: await hashPin(pin, salt) }
  localStorage.setItem(key(uid), JSON.stringify(stored))
}

export async function verifySettingsPin(uid: string, pin: string) {
  const value = localStorage.getItem(key(uid))
  if (!value) return false
  const stored = JSON.parse(value) as StoredPin
  return (await hashPin(pin, decode(stored.salt))) === stored.hash
}

export function removeSettingsPin(uid: string) {
  localStorage.removeItem(key(uid))
}
