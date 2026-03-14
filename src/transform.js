import sharp from "sharp";

/**
 * Resize and/or center-crop an image in place using sharp.
 *
 * Operations are applied in this order when both are specified:
 *   1. crop  -- extract a centered region of the requested dimensions
 *   2. resize -- scale the (possibly cropped) image to the requested dimensions
 *
 * @param {object} options
 * @param {string}   options.filePath              - Absolute path to the image file (modified in place).
 * @param {{width: number, height: number}|null} [options.resize] - Target dimensions for scaling.
 * @param {{width: number, height: number}|null} [options.crop]   - Target dimensions for center crop.
 * @param {boolean} [options.verbose]              - Print progress info to stderr.
 * @returns {Promise<void>}
 */
export async function resizeImage({ filePath, resize = null, crop = null, verbose = false }) {
  if (!resize && !crop) {return;}

  let pipeline = sharp(filePath);
  const meta = await pipeline.metadata();

  if (crop) {
    const srcWidth  = meta.width  ?? 0;
    const srcHeight = meta.height ?? 0;

    if (crop.width > srcWidth || crop.height > srcHeight) {
      throw new Error(
        `Crop dimensions ${crop.width}x${crop.height} exceed image dimensions ${srcWidth}x${srcHeight}.`
      );
    }

    const left = Math.floor((srcWidth  - crop.width)  / 2);
    const top  = Math.floor((srcHeight - crop.height) / 2);

    if (verbose) {
      process.stderr.write(
        `Cropping to ${crop.width}x${crop.height} (offset ${left},${top})...\n`
      );
    }

    pipeline = pipeline.extract({ left, top, width: crop.width, height: crop.height });
  }

  if (resize) {
    if (verbose) {
      process.stderr.write(`Resizing to ${resize.width}x${resize.height}...\n`);
    }
    pipeline = pipeline.resize(resize.width, resize.height, { fit: "fill" });
  }

  const buffer = await pipeline.toBuffer();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, buffer);
}
