/**
 * 直接调用 @8thwall/image-target-cli 内部 API 生成识别目标 JSON
 * 用法：node scripts/gen-target.mjs
 */
import {fileURLToPath, pathToFileURL} from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CLI_BASE = path.resolve(
  String.raw`C:\Users\Administrator\AppData\Local\npm-cache\_npx\d9fd33f22c0f2465\node_modules\@8thwall\image-target-cli\src`
)

// On Windows, dynamic import needs file:// URLs
const toFileUrl = (p) => pathToFileURL(p).href

const {applyCrop}      = await import(toFileUrl(path.join(CLI_BASE, 'apply.js')))
const {getDefaultCrop} = await import(toFileUrl(path.join(CLI_BASE, 'crop.js')))

// sharp lives at node_modules/sharp (3 levels up from src/)
const sharpPath = path.join(CLI_BASE, '../../..', 'sharp', 'lib', 'index.js')
const {default: sharp} = await import(toFileUrl(sharpPath))

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
