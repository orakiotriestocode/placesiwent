# Free local Belgian Dutch voice

Nathalie is an optional Piper voice for Belgian Dutch (`nl_BE`). Speech is
synthesized on the receiving device using a dedicated browser worker and Web
Audio. No text is sent to a speech API. Pairing and delivery still use the app's
existing connection service.

## Pinned model

- Source: https://huggingface.co/rhasspy/piper-voices/tree/36915ed3d066024c63841a1d20f29edcdbc37c14/nl/nl_BE/nathalie/medium
- Model card: https://huggingface.co/rhasspy/piper-voices/blob/36915ed3d066024c63841a1d20f29edcdbc37c14/nl/nl_BE/nathalie/medium/MODEL_CARD
- Repository identifies the model collection as MIT; Nathalie's model card identifies its recording dataset as CC0.
- Model card describes one speaker, medium quality, 22,050 Hz, fine-tuned from the U.S. English Lessac medium voice.
- This older revision is pinned for compatibility with the phonemizer. Newer model revisions must be tested before updating.

## Runtime dependencies

Static runtime files are downloaded from these versioned public sources only
after the receiver chooses Enable & try Nathalie:

- ONNX Runtime Web 1.18.0 (MIT): https://github.com/microsoft/onnxruntime/tree/v1.18.0
  - Licence: https://github.com/microsoft/onnxruntime/blob/v1.18.0/LICENSE
  - Distributed by cdnjs: https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/
- @diffusionstudio/piper-wasm 1.0.0 (package metadata: MIT): https://www.npmjs.com/package/@diffusionstudio/piper-wasm/v/1.0.0
  - Source and build instructions: https://github.com/diffusion-studio/piper-wasm
  - Includes Piper phonemization and eSpeak NG. eSpeak NG is GPL-3.0-or-later; source and licence: https://github.com/espeak-ng/espeak-ng
  - Piper phonemizer source: https://github.com/wide-video/piper-phonemize
  - Distributed by jsDelivr: https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/

The app's worker/adapter are original integration code. Dependency binaries and
voice models are served by their public distributors rather than committed into
this repository.

## Practical limits

First setup downloads approximately 100 MB. The model is cached using the Cache
API when storage is available; browser storage may be denied or evicted. Runtime
assets also use ordinary browser HTTP caching. No persistent storage permission
is requested. Offline availability is not guaranteed.

Single-threaded CPU/WASM inference needs no SharedArrayBuffer, special HTTP
headers, paid API key, account or metered speech allowance. It can take longer on
older devices. Browser tests cover Chromium; iPhone/iPad Safari still needs a
real-device check. On unsupported devices or a download failure, ordinary device
voices remain available. There is no paid fallback.

Stop interrupts playback immediately. Stopping while synthesis is running
terminates the worker; enable the voice again to reload it from cache. The model
is never silently downloaded on page load or when joining from the controller.

## Checks

- node scripts/bear-talk/local-voice-check.cjs
- node scripts/bear-talk/speech-check.cjs
- node scripts/bear-talk/i18n-check.cjs
- node scripts/bear-talk/pairing-check.cjs

Real browser QA: explicit first download, two synthesized messages, immediate
Stop during generation, re-enable from cache, language filtering and interface
translation. Audio quality is subjective and should be assessed on the intended
receiving device.
