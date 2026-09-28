# MetroVoiceOver

A small, cross-device utility for creating British railway and Underground announcements with the fixed `en-GB-SoniaNeural` voice. It runs in iPhone Safari, iPad Safari, and desktop browsers. The interface sends text to the server; the Vercel Python Function runs `edge-tts==7.2.8` and returns the generated MP3. The browser does not use `speechSynthesis` or run the TTS package.

## Features

- Generate, play, replay, seek, and download a temporary MP3; optionally apply one station PA preset and download the processed WAV.
- Fixed Sonia voice with a speed control from −10% to +15% (default +3%); pitch and volume stay at +0 Hz and +0%.
- Twenty station announcement examples in six categories. Selecting an example fills the editor without generating audio.
- Text is limited to 2,000 characters. Audio is returned in the response and is not stored by this project.
- Optional Modern Station PA and Deep Tube processing runs after the single TTS response. The default No effect option keeps the original MP3 path.
- No account, Azure resource, Microsoft account, API key, database, or external audio library is required.

## Architecture

```text
Safari / desktop browser
  → POST /api/tts over HTTPS
  → Vercel Python Function
  → edge-tts 7.2.8, voice en-GB-SoniaNeural
  → Microsoft Edge online speech service
  → one audio/mpeg response
  → No effect: original MP3 playback/download
  → PA preset: browser OfflineAudioContext post-processing at the decoded sample rate → PCM WAV playback/download
```

`edge-tts` runs only in `api/tts.py`, on the Vercel backend. The browser makes one synthesis request; a selected PA preset then processes that response with the Web Audio API and exports the result as 16-bit PCM WAV. The presets use sample-rate-safe filters, compression, light saturation, two delay taps, a short low-mix reverb, loudness matching, and a −1 dBFS peak ceiling. The no-effect path skips decoding and post-processing and keeps the original MP3. Generated audio stays in memory and as a temporary browser object URL; this app does not save it to a server library. Announcement text is sent to Vercel and the Edge speech service to produce audio.

The interface uses the self-hosted Johnston100 regular font file supplied by the site owner.

## Local setup

Requirements: Python 3.12 or later, Node.js 20 or later, and the Vercel CLI.

1. Install Python dependencies: `python -m pip install -r requirements.txt`.
2. Install the Vercel CLI if needed: `npm install --global vercel`.
3. From this directory, run `vercel dev` and open the local URL it prints. This serves the static page and Python function together.
4. Send a test request with `curl -X POST http://localhost:3000/api/tts -H "Content-Type: application/json" --data "{\"text\":\"The next train departs from platform four.\",\"rate\":\"+3%\"}" --output announcement.mp3`.

The local generation request also needs an internet connection to reach the Edge speech service. PA effects require a browser with `OfflineAudioContext` support (current Safari, Chrome, or Edge). No Azure credentials are used. Do not commit locally generated audio.

## Checks

Run the Python API validation tests with `python -m unittest discover -s tests -v`, and the example/audio export checks with `node tests/test_examples.mjs` and `node tests/test_audio_effects.mjs`. Check JavaScript syntax with `node --check public/app.js`, `node --check public/audio-effects.js`, and `node --check public/examples.js`; check Python syntax with `python -m compileall -q api tests`.

There is no client-side build step: Vercel serves the frontend from `public/` and maps `api/tts.py` to `POST /api/tts`. The project uses Vercel's `Other` framework preset so the static page and file-based Python Function keep their separate routes. The function has a 60-second platform limit and an internal 50-second generation timeout. If Microsoft’s Edge speech endpoint is temporarily unavailable, the page shows a retryable error and does not substitute another voice. If browser-side effect rendering fails, the page reports the error and does not offer the unprocessed MP3 as if it had the selected effect.

## Deployment

The GitHub repository is [`xinliaouk-code/MetroVoiceOver`](https://github.com/xinliaouk-code/MetroVoiceOver), with `main` as the production source branch. Import the repository into a Vercel project named `metrovoiceover`; Vercel should detect the static site and Python function. No environment variables are required. After deployment, test `POST /api/tts` on the production origin and verify original MP3 generation, each processed WAV preset, browser playback, and downloads.
