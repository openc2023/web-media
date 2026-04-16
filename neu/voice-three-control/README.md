# Voice-Controlled Three.js Motion

A static Three.js demo that reacts to live microphone input. The project is
organized into source modules, local vendor files, and a standard `assets`
folder so it can be opened without a build step or CDN dependency.

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
