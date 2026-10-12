# MetroVoiceOver implementation status

## MVO-FIX-001 — 2026-10-13

- IMPLEMENTED: endpoint compatibility fix for edge-tts 7.2.8; numeric upstream status logging without exception URLs.
- VERIFIED: GitHub main and local source match baseline 3f117fcc43ac15880ec942034e58f38f81672599; regression tests; real short and multi-sentence Sonia MP3 generation through the local HTTP handler.
- VERIFIED: repair ab3ec51 pushed to main; Vercel production deployment READY and production POST /api/tts returns HTTP 200 with a valid 24 kHz mono Sonia MP3.
- NOT TESTED: browser playback and downloads after release, human listening acceptance.
- RELEASED: user authorised push; Git integration deployed the repair. Use https://metrovoiceover.vercel.app/ for the current production version; immutable previous deployment URLs retain their original source.

The fixed Sonia voice, speed range, audio effects, validation, temporary audio handling and analytics retain their existing behaviour. See [task record](tasks/MVO-FIX-001.md).
