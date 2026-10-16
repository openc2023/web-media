# AR Tracking Comparison

This folder is for testing alternative image-tracking engines without changing the live `Top` MindAR page.

## Structure

- `8th-wall/`
  Test 8th Wall image target tracking.
- `zappar/`
  Test Zappar image tracking.

## Shared Test Target

- Image target: `../Top/assets/images/000-top.png`
- Model: `../Top/assets/3d/gltf/box.glb`
- MindAR reference page: `../Top/index.html`

## What To Compare

1. First recognition speed
2. Tracking stability while the phone moves slowly
3. Model/video alignment on the artwork
4. Recovery speed after target is lost
5. Camera rendering quality on iOS Safari and Android Chrome
6. Deployment difficulty on GitHub Pages

## Test Notes

Use the same phone, same lighting, same printed/displayed artwork, and same camera distance for each engine.
