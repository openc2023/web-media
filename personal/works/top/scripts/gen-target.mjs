/**
 * 直接调用 @8thwall/image-target-cli 内部 API 生成识别目标 JSON
 * 用法：node scripts/gen-target.mjs
 */
import {fileURLToPath, pathToFileURL} from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Use a local install by default, or point to an existing CLI src directory.
import fs from 'node:fs/promises'
import {createRequire} from 'node:module'

const CLI_BASE = process.env.IMAGE_TARGET_CLI_SRC
  ? path.resolve(process.env.IMAGE_TARGET_CLI_SRC)
  : path.resolve(__dirname, '../../../node_modules/@8thwall/image-target-cli/src')

for (const file of ['apply.js', 'crop.js']) {
  try {
    await fs.access(path.join(CLI_BASE, file))
  } catch {
    console.error(`Missing image target CLI source: ${path.join(CLI_BASE, file)}`)
    console.error('Set IMAGE_TARGET_CLI_SRC to the installed @8thwall/image-target-cli/src directory. See ../README.md.')
    process.exit(1)
  }
}

const toFileUrl = (p) => pathToFileURL(p).href
const {applyCrop} = await import(toFileUrl(path.join(CLI_BASE, 'apply.js')))
const {getDefaultCrop} = await import(toFileUrl(path.join(CLI_BASE, 'crop.js')))
const cliRequire = createRequire(path.join(CLI_BASE, 'apply.js'))
const sharp = cliRequire('sharp')

const IMAGE_PATH  = path.join(__dirname, '..', 'assets', 'images', '000-top.png')
const OUTPUT_DIR  = path.join(__dirname, '..', 'assets', 'targets', '000-top')
const TARGET_NAME = '000-top'

const image = sharp(IMAGE_PATH)
const meta  = await image.metadata()

console.log(`Image: ${meta.width}x${meta.height} (${meta.format})`)

const geometry = getDefaultCrop(meta, false)
console.log('Crop geometry:', geometry)

const {dataPath} = await applyCrop(
  image,
  {type: 'FLAT', geometry},
  OUTPUT_DIR,
  TARGET_NAME,
  true
)

console.log('Done! Target JSON saved to:', dataPath)
