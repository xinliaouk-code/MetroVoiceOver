# MVO-FIX-001 — repair upstream synthesis endpoint

Date: 2026-10-13 (Asia/Shanghai)
Status: IMPLEMENTED / LOCAL AND PRODUCTION SYNTHESIS VERIFIED / RELEASED.

## Input and baseline
User: inspect GitHub code and repair Audio generation failed on MetroVoiceOver.
GitHub xinliaouk-code/MetroVoiceOver main, local nested repository, and deployment dpl_B6gkewkDRwxBVHpW1MfndTMub67V all match commit 3f117fcc43ac15880ec942034e58f38f81672599. Nested working tree was clean at task opening.
User messages in this chat are the current repair prompt. There is no applicable MetroVoiceOver prompt file or audio Reference Index; the parent audio-reference folder is empty. No station asset/reference implementation is included.

## Cause and fix
Production logs show WSServerHandshakeError and application HTTP 502. A controlled local edge-tts 7.2.8 request to the legacy synthesis host also returned upstream HTTP 403.
Upstream issue https://github.com/rany2/edge-tts/issues/490 reports the October 2026 endpoint failure. Reviewed open, unmerged upstream PR https://github.com/rany2/edge-tts/pull/491 (head 8a5844c3a1d33e4e8f2f3e14535542c0d75d4248) changes the synthesis endpoint. Its separate locale date-parser change is not needed for the reproduced fault and is not incorporated here.
api/tts.py applies the endpoint-only change directly to edge_tts.communicate.WSS_URL, the module global used by the pinned Communicate implementation. New host: api.msedgeservices.com, path /tts/cognitiveservices/websocket/v1, key parameter Ocp-Apim-Subscription-Key populated from the package's existing public client constant. No alternate voice, third-party speech endpoint, new credential or fork dependency is used.
Error logging retains exception class and adds only numeric HTTP status; it never formats exception URLs or announcement text.

## Change manifest and protected files
Changed: api/tts.py; tests/test_tts_api.py; README.md; docs/IMPLEMENTATION_PLAN.md; docs/tasks/MVO-FIX-001.md.
Protected: nested .git history; frontend; requirements.txt/pyproject.toml edge-tts pin; all parent station sources, assets, audio, launchers/builds and pre-existing parent working changes.
No station GAME_DESIGN/AUDIO_SPEC/FLEET_CATALOGUE/reference-index semantic update is needed: this independent generator transport fix does not change station content or gameplay. No new visual/audio reference or retained implementation prompt was created.

## Checks
- Python unittest: 10 tests PASS, including transport hostname/path/query mapping, unchanged Sonia/rate/pitch/volume, metadata exclusion, audio chunk concatenation and propagation of mid-stream failure instead of returning truncated success.
- Python compileall, JavaScript syntax and git diff --check: PASS.
- Node examples, audio effects/WAV export, editor visual rules, analytics rules: all four suites PASS.
- Actual local HTTP handler POST /api/tts, short text +3%: HTTP 200 audio/mpeg, no-store; 17,424 bytes; macOS afinfo decodes 24 kHz mono, 48 kbps, 2.904 seconds.
- Actual local HTTP handler POST /api/tts, multi-sentence text -10%: HTTP 200 audio/mpeg, no-store; 57,312 bytes; afinfo decodes 24 kHz mono, 48 kbps, 9.552 seconds.
- Diagnostic transport used the existing macOS system proxy in the isolated test runner only. No proxy setting or generated MP3 is a production dependency or committed source.

## Limitations and next step
Local and production synthesis are VERIFIED; browser playback, effects rendering on the released response, and human listening are NOT TESTED. This compatibility override relies on the explicitly pinned package internals; remove it after reviewing a future package release that incorporates the new endpoint, with live synthesis verification.
The user explicitly authorised pushing the reviewed repair on 2026-10-13. Push to the existing main branch and verify the existing Vercel Git integration deployment, deployed commit and production MP3 generation. Browser playback/download and human listening remain separate checks.

## Parent documentation checker limitation
The required parent scripts/check_docs_sync.py was run and returned FAIL against its historical GLT-050 baseline: pre-existing main.gd, Class345 .import and project/render differences. The parent tracked Git status is identical to task opening; these failures are not caused by this nested API repair.
The checker also regenerated its ignored historical evidence/v05/docs-change-manifest.json at its default output path. This was unintended; no task-opening copy or matching backup was found, so exact historical manifest preservation cannot be claimed. This generated-document exception does not alter station runtime assets or the nested repository. Future checks must set an owned --output path before running this historical checker.
Manual rule-to-code review: fixed Sonia/rate/pitch/volume, validation, error response, MP3 headers, temporary storage, frontend effects and parent gameplay authority preserved. New host is Microsoft's endpoint verified by live synthesis; no temporary script/proxy/file is a runtime dependency.

## Authorised release evidence
User explicitly authorised pushing on 2026-10-13. Native Git push had no authenticated HTTPS credential; the existing GitHub connector published exactly the five reviewed files using a fast-forward ref update with expected-head checking. Published repair commit: ab3ec51fb76ed4bf12ddfaed709c444277ccd977. Local validation commit was preserved on codex/local-tts-validation, and local main was synced to the identical remote source tree without overwriting work.
Vercel Git production deployment: dpl_ASiJqccp9ChYLkYg1MRwRDqM32F7, metrovoiceover-15eqs7k7e-x-ce13.vercel.app, source ab3ec51fb76ed4bf12ddfaed709c444277ccd977, READY. Production alias https://metrovoiceover.vercel.app/api/tts returned HTTP 200 audio/mpeg, no-store, 17,424-byte MP3, 24 kHz mono / 48 kbps / 2.904 seconds. No additional deployment project, credential or configuration was introduced.
The user-supplied older immutable deployment URL continues to refer to the original deployment; the current production alias is the supported entry point. The endpoint has no known fixed expiry interval, and future upstream protocol changes may require another compatibility update.
