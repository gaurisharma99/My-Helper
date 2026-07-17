# Voice Assistant Architecture

## Current System

User

↓

Frontend

↓

POST /chat

↓

Backend

↓

Groq LLM

↓

Text Response

---

## Planned Voice Architecture

User

↓

🎤 Speech

↓

ASR

↓

Text

↓

Groq LLM

↓

Assistant Response

↓

🔊 TTS

↓

Audio

---

## Backend

Routes

POST /chat

POST /tts

Future:

POST /asr

---

## Frontend

- Chat Interface
- Voice Input Button
- Speak Button
- Audio Player

---

## Design Principles

- Modular
- Loosely Coupled
- Easy to Replace Models
- Easy to Scale