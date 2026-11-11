# Amaro voice sandbox

Standalone, read-only prototype. Open `index.html` through HTTPS or localhost.
No production scripts, database bindings, tracking, form submission or network
API calls are included. CSP blocks fetch/XHR and form submissions. All draft
state stays in page memory. Catalog is a public executive snapshot, 2026-11-11.

Uses browser SpeechRecognition (pt-BR), not Whisper or a provisioned cloud API.
The browser may transmit audio to its own speech provider. Support and provider
availability vary; unsupported/denied/network states allow text testing instead.
No audio files are recorded or retained by this application. Recording stops
at 60 seconds, with a 65-second abort watchdog and abort on page hide.

Exact names and a small explicit alias dictionary produce suggestions. Ambiguous
or unknown fragments require selection/discard. Negations/corrections block
automatic interpretation. All results remain editable; simulation never writes.

Run: `node --test tests/voice-sandbox.test.cjs` from repository root.
Browser callback lifecycle was tested with a mocked recognition provider, not
human audio. Real-device acceptance: grant microphone access, dictate names,
pause for automatic stop, confirm the live suggestions, simulate. Also test denied
permission, silence, backgrounding, ambiguous names and a second recording.
No claims of kitchen-noise accuracy or cross-device voice reliability are made.
Speech results update suggestions immediately; manual text edits debounce 250ms.
Speech-end or result inactivity starts a 3.5-second stop timer, cancelled by new
speech/results. Recognition-provider end can occur sooner. A new start appends
to the current transcript. Clear aborts recognition and resets manual choices.
