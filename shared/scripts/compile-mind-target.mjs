import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { CompilerBase } from "../../../.mindar-build2/node_modules/mind-ar/src/image-target/compiler-base.js";
import { buildTrackingImageList } from "../../../.mindar-build2/node_modules/mind-ar/src/image-target/image-list.js";
import { extractTrackingFeatures } from "../../../.mindar-build2/node_modules/mind-ar/src/image-target/tracker/extract-utils.js";
import "../../../.mindar-build2/node_modules/mind-ar/src/image-target/detector/kernels/cpu/index.js";

const require = createRequire(import.meta.url);
const { PNG } = require("../../../.mindar-build2/node_modules/pngjs");

class NodeCompiler extends CompilerBase {
    createProcessCanvas(img) {
        return {
            getContext() {
                return {
                    drawImage() {},
                    getImageData() {
                        return { data: img.rgbaData };
                    }
                };
            }
        };
    }

    compileTrack({ progressCallback, targetImages, basePercent }) {
        return new Promise((resolve) => {
            const percentPerImage = (100 - basePercent) / targetImages.length;
            let percent = 0;
            const list = [];

            for (let i = 0; i < targetImages.length; i += 1) {
                const targetImage = targetImages[i];
                const imageList = buildTrackingImageList(targetImage);
                const percentPerAction = percentPerImage / imageList.length;
                const trackingData = extractTrackingFeatures(imageList, () => {
                    percent += percentPerAction;
                    progressCallback(basePercent + percent);
                });
                list.push(trackingData);
            }

            resolve(list);
        });
    }
}

const loadPngImage = async (filepath) => {
    const buffer = await fs.readFile(filepath);
    const png = PNG.sync.read(buffer);
    return {
        width: png.width,
        height: png.height,
        rgbaData: Uint8ClampedArray.from(png.data)
    };
};

const main = async () => {
    const [, , inputArg, outputArg] = process.argv;
    if (!inputArg || !outputArg) {
        console.error("Usage: node compile-mind-target.mjs <input.png> <output.mind>");
        process.exit(1);
    }

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(scriptDir, "../../..");
    const inputPath = path.resolve(workspaceRoot, inputArg);
    const outputPath = path.resolve(workspaceRoot, outputArg);

    const image = await loadPngImage(inputPath);
    const compiler = new NodeCompiler();

    console.log(`Compiling target from ${inputArg}`);
    await compiler.compileImageTargets([image], (progress) => {
        console.log(`Progress: ${Math.round(progress)}%`);
    });

    const buffer = compiler.exportData();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(buffer));
    console.log(`Wrote ${outputArg}`);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
