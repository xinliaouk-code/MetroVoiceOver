# MetroVoiceOver

A small, cross-device utility for creating British railway and Underground announcements with the fixed `en-GB-SoniaNeural` voice. It runs in iPhone Safari, iPad Safari, and desktop browsers. The interface sends text to the server; the Vercel Python Function runs `edge-tts==7.2.8` and returns the generated MP3. The browser does not use `speechSynthesis` or run the TTS package.

## Features

- Generate, play, replay, seek, and download a temporary MP3.
- Fixed Sonia voice with a speed control from −10% to +15% (default +3%); pitch and volume stay at +0 Hz and +0%.
- Twenty station announcement examples in six categories. Selecting an example fills the editor without generating audio.
- Text is limited to 2,000 characters. Audio is returned in the response and is not stored by this project.
- No account, Azure resource, Microsoft account, API key, database, or audio library is required.

## Architecture

```text
Safari / desktop browser
  → POST /api/tts over HTTPS
  → Vercel Python Function
  → edge-tts 7.2.8, voice en-GB-SoniaNeural
  → Microsoft Edge online speech service
  → audio/mpeg response
  → browser playback or MP3 download
```

`edge-tts` runs only in `api/tts.py`, on the Vercel backend. The browser bundle contains only the editor, example text, and audio controls. Generated audio is held in memory for the request and as a temporary browser object URL; this app does not save it to a server library. Announcement text is sent to Vercel and the Edge speech service to produce audio.

## Local setup

Requirements: Python 3.12 or later, Node.js 20 or later, and the Vercel CLI.

1. Install Python dependencies: `python -m pip install -r requirements.txt`.
2. Install the Vercel CLI if needed: `npm install --global vercel`.
3. From this directory, run `vercel dev` and open the local URL it prints. This serves the static page and Python function together.
4. Send a test request with `curl -X POST http://localhost:3000/api/tts -H "Content-Type: application/json" --data "{\"text\":\"The next train departs from platform four.\",\"rate\":\"+3%\"}" --output announcement.mp3`.

The local generation request also needs an internet connection to reach the Edge speech service. No Azure credentials are used. Do not commit locally generated audio.

## Checks

Run the Python API validation tests with `python -m unittest discover -s tests -v`, and the example-library check with `node tests/test_examples.mjs`. Check JavaScript syntax with `node --check app.js` and `node --check examples.js`; check Python syntax with `python -m compileall -q api tests`.

There is no client-side build step: Vercel serves the static files at the project root and deploys `api/tts.py` as a Python Function. The function has a 60-second platform limit and an internal 50-second generation timeout. If Microsoft’s Edge speech endpoint is temporarily unavailable, the page shows a retryable error and does not substitute another voice.

## Deployment

The GitHub repository is [`xinliaouk-code/MetroVoiceOver`](https://github.com/xinliaouk-code/MetroVoiceOver), with `main` as the production source branch. Import the repository into a Vercel project named `metrovoiceover`; Vercel should detect the static site and Python function. No environment variables are required. After deployment, test `POST /api/tts` on the production origin and verify both browser playback and MP3 download.
