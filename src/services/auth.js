import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth, firebaseConfigError } from '../lib/firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

const allowedEmails = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export const allowedEmailConfigError = allowedEmails.length
  ? null
  : 'Missing VITE_ALLOWED_EMAILS. Add the two approved Google accounts to your local environment.'

function ensureAuth() {
  if (!auth) {
    throw new Error(firebaseConfigError || 'Firebase Auth is not configured.')
  }
}

function prefersRedirect() {
  if (typeof window === 'undefined') {
    return false
  }

  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches
  const narrowViewport = window.matchMedia?.('(max-width: 768px)')?.matches

  return Boolean(coarsePointer || narrowViewport)
}

export function isUserAllowed(user) {
  if (!user?.email || !user.emailVerified) {
    return false
  }

  if (!allowedEmails.length) {
    return true
  }

  return allowedEmails.includes(user.email.toLowerCase())
}

export function observeAuthState(callback) {
  ensureAuth()
  return onAuthStateChanged(auth, callback)
}

export async function signIn() {
  ensureAuth()

  if (prefersRedirect()) {
    await signInWithRedirect(auth, provider)
    return null
  }

  return signInWithPopup(auth, provider)
}

export async function completeRedirectSignIn() {
  ensureAuth()
  return getRedirectResult(auth)
}

export async function signOutUser() {
  ensureAuth()
  return signOut(auth)
}
