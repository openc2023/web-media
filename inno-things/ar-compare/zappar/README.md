# Zappar Image Tracking Test

Purpose: compare Zappar image tracking against the current MindAR implementation.

## Target Assets

- Image target: `../../Top/assets/images/000-top.png`
- 3D model: `../../Top/assets/3d/gltf/box.glb`

## Setup Notes

Zappar normally needs its Universal AR SDK setup and an image target generated for Zappar's tracking pipeline.

Before this page can become a working test, confirm:

1. Zappar package/CDN path
2. License/account requirement
3. Zappar image target file generated from `000-top.png`

Keep this experiment isolated until those files are ready.

## Goal

When the `000-top` image is recognized, place `box.glb` above the artwork using the same visual target as the MindAR page.
