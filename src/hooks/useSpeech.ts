import { useSyncExternalStore } from 'react'

// The phone's or computer's own voices (the Web Speech API): free, offline on most phones, no audio files to host.
// Voices load a moment after the page does, and differ by device; a language without one can't be heard there.
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null

function subscribe(listener: () => void) {
  if (!synth) return () => undefined
  synth.addEventListener('voiceschanged', listener)
  return () => synth.removeEventListener('voiceschanged', listener)
}
const snapshot = () => (synth ? synth.getVoices().map((v) => v.lang).join(',') : '')

/** The voice for a language ("ja-JP"), the closest this device has, or none. */
function voiceFor(lang: string): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? []
  const base = lang.split('-')[0].toLowerCase()
  return voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base))
}

/** Whether this device can say things in a language, live as its voices load. */
export function useCanSpeak(lang: string): boolean {
  useSyncExternalStore(subscribe, snapshot, () => '')
  return !!synth && !!voiceFor(lang)
}

/** Say it (a little slower than normal, for learning). */
export function speak(text: string, lang: string) {
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, ''))
  u.lang = lang
  const v = voiceFor(lang)
  if (v) u.voice = v
  u.rate = 0.8
  synth.speak(u)
}
