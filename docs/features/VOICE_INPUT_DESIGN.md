# Voice Input Design

This document describes the design and implementation approach for voice input —
the primary intended interaction path for both onboarding and regular interview sessions.

---

## Why voice input matters

Typing a life story is slow. Speaking is 3–5x faster and more natural.
The onboarding session's 5-minute target is only realistic with voice.
In regular sessions, the difference between "I'll do it later" and "I'll do it now"
is often just friction — voice input removes most of it.

---

## Implementation approach: Groq Whisper API (v1)

Three options were considered:

| | Web Speech API | Groq Whisper | Local Whisper |
|---|---|---|---|
| Setup | Zero | `GROQ_API_KEY` in `.env` | ffmpeg + model download |
| Cost | Free | Free (100h/month) | Free |
| Latency | Real-time | ~0.3s/utterance | Slow |
| Accuracy (Japanese) | Depends on network | Excellent | Good |
| Offline | No | No | Yes |
| Browser support | Chrome/Edge only | All browsers | All browsers |

**Decision: Groq Whisper.**

Rationale:
- Web Speech API requires connection to Google's servers — fails in many network environments
- Groq's free tier (100h audio/month) far exceeds personal use
- ~0.3s latency is imperceptible for conversational turns
- Fits the existing architecture: one more API key, same pattern as DeepSeek
- `MediaRecorder` (used for recording) is supported in all modern browsers

---

## UX design

### Trigger: click-to-toggle (not hold-to-record)

- Click mic button → recording starts (button turns red, pulse animation)
- Click again → recording stops, transcript fills the textarea
- Why toggle over hold: onboarding answers are long (30–60 seconds); holding a button that long is tiring

### Interim results

Show real-time interim transcript in the textarea as the user speaks.
The text updates live (grayed out) and commits when speech pauses.
This makes the interaction feel responsive and lets the user see if it's working.

### Auto-language

Set `SpeechRecognition.lang` from the current i18n language:
- `ja` → `ja-JP`
- `en` → `en-US`

### Graceful degradation

- Browser doesn't support Web Speech API → mic button is hidden (no error thrown)
- Mic permission denied → show a one-line error message below the textarea
- Network error during recognition → silently recover; user can retry

---

## Flow

```
User clicks 🎤
  → MediaRecorder starts (browser built-in, all browsers)
  → button turns red / shows recording state

User clicks ⏹
  → MediaRecorder stops, audio blob collected
  → POST /api/transcribe  (FormData: audio file + language)
  → Groq whisper-large-v3-turbo transcribes
  → text inserted into textarea

User reviews and clicks 送信
```

## Component changes

### Shared hook: `useVoiceInput`

```
useVoiceInput(onTranscript)
  → { isRecording, isTranscribing, start(lang), stop, error }
```

- `isTranscribing`: true while waiting for Groq response (shows spinner/message)
- `start(lang)`: begins MediaRecorder, stores lang for transcription request
- `stop()`: stops recorder, triggers transcription

### Mic button states

```
idle:          [ 🎤 ]  gray
recording:     [ ⏹ ]  red + pulse animation
transcribing:  [ ⏳ ]  gray + disabled
```

---

## Scope

Files to change:
- `packages/web/src/hooks/useVoiceInput.ts`
- `packages/server/src/routes/transcribe.ts` (new)
- `packages/server/src/index.ts`
- `.env` (add `GROQ_API_KEY`)

---

## v2 considerations (out of scope for now)

- Auto-submit after transcription completes (opt-in)
- Push-to-talk mobile UX
