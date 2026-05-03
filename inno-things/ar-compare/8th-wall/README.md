# 8th Wall Image Target Test

Purpose: compare 8th Wall image target tracking against the current MindAR implementation.

## Target Assets

- Image target: `../../Top/assets/images/000-top.png`
- 3D model: `../../Top/assets/3d/gltf/box.glb`

## Setup Notes

8th Wall now has a different distribution model from the old hosted platform. Before this page can become a working test, confirm which package path we will use:

1. 8th Wall open/distributed engine package
2. Self-hosted engine files
3. Any required license/config file

Keep this experiment isolated until the SDK is confirmed.

## Goal

When the `000-top` image is recognized, place `box.glb` above the artwork using the same visual target as the MindAR page.
