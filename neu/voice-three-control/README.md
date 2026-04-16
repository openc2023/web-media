# Voice-Controlled Three.js Motion

노이미디어웍스에서 개발한 인터랙티브 프로젝트입니다.
사운드와 장면 반응을 가볍고 재미있게 즐길 수 있도록 만든 작업입니다.

A playful interactive Three.js project that reacts to live microphone input.
This piece is built as a small interactive scene rather than a tool or landing
page. Talk, hum, or blow into the mic and the windmill responds to your voice
while the atmosphere of the scene shifts with it.

## Project

- Voice input drives the windmill animation speed
- Microphone intensity affects the scene response
- Mushroom environment, particles, glow, and camera framing build the mood
- Designed as a fun interactive visual experience

## Technology

- HTML
- CSS
- JavaScript ES Modules
- Three.js
- GLTF / GLB model loading
- Web Audio API

## Structure

```text
voice-three-control/
  assets/
    audio/
    images/
    models/
      mogu.glb
    textures/
  src/
    css/
      main.css
    js/
      audio/
      core/
      objects/
      ui/
      utils/
      main.js
  vendor/
    three/
      build/
      examples/jsm/controls/
  index.html
```

## Run

Do not open `index.html` with `file://`.

Use one of these:

```text
start-local-server.bat
```

or:

```powershell
python -m http.server 4173
```

Then visit:

```text
http://127.0.0.1:4173
```

## Notes

- No bundler
- No CDN imports
- Three.js vendor files are stored locally in `vendor/three/`
- Existing model assets belong in `assets/models/`

## License

This project is provided for viewing and experience only.

- No derivative works
- No redistribution
- No resale
- No commercial resale or repackaging

Please contact the original author for any additional permission.
