import OpenAI from "openai";
import { createWriteStream, mkdirSync, unlink } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import https from "node:https";
import { VALID_SIZES, VALID_MODELS, VALID_QUALITIES, VALID_STYLES } from "./constants.js";

/**
 * Download a URL to a file path.
 * @param {string} url
 * @param {string} dest
 * @returns {Promise<void>}
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = new URL(url).protocol === "https:" ? https : null;
    if (!protocol) {
      reject(new Error(`Unsupported protocol in URL: ${url}`));
      return;
    }

    const file = createWriteStream(dest);

    const cleanup = () => {
      file.close();
      unlink(dest, (e) => {
        if (e) {
          process.stderr.write(`Warning: could not remove partial file: ${e.message}\n`);
        }
      });
    };

    protocol
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          cleanup();
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close((err) => (err ? reject(err) : resolve()));
        });
      })
      .on("error", (err) => {
        cleanup();
        reject(err);
      });
  });
}

/**
 * Generate an image with DALL-E and save it to disk.
 *
 * @param {object} options
 * @param {string}   options.prompt    - The image generation prompt.
 * @param {string}   options.output    - Destination file path (.png/.jpg/.webp).
 * @param {string}  [options.model]    - DALL-E model (default: "dall-e-3").
 * @param {string}  [options.size]     - Image size (default: "1024x1024").
 * @param {string}  [options.quality]  - "standard" | "hd" (default: "standard", dall-e-3 only).
 * @param {string}  [options.style]    - "vivid" | "natural" (default: "vivid", dall-e-3 only).
 * @param {boolean} [options.verbose]  - Print extra info to stderr.
 * @returns {Promise<{filePath: string, revisedPrompt: string|null}>}
 */
export async function generateImage(options) {
  const {
    prompt,
    output,
    model = "dall-e-3",
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
    verbose = false,
  } = options;

  if (!prompt) {
    throw new Error("A prompt is required.");
  }
  if (!output) {
    throw new Error("An output path is required (--output).");
  }

  if (!VALID_MODELS.includes(model)) {
    throw new Error(`Invalid model "${model}". Valid options: ${VALID_MODELS.join(", ")}.`);
  }

  const validSizes = VALID_SIZES[model];
  if (!validSizes.includes(size)) {
    throw new Error(
      `Invalid size "${size}" for ${model}. Valid options: ${validSizes.join(", ")}.`
    );
  }

  if (model === "dall-e-3") {
    if (!VALID_QUALITIES.includes(quality)) {
      throw new Error(
        `Invalid quality "${quality}". Valid options: ${VALID_QUALITIES.join(", ")}.`
      );
    }
    if (!VALID_STYLES.includes(style)) {
      throw new Error(`Invalid style "${style}". Valid options: ${VALID_STYLES.join(", ")}.`);
    }
  }

  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set.");
  }

  const client = new OpenAI({ apiKey });

  if (verbose) {
    const extras = model === "dall-e-3" ? `, ${quality}, ${style}` : "";
    process.stderr.write(`Generating image with ${model} (${size}${extras})...\n`);
  }

  const requestParams = { model, prompt, n: 1, size, response_format: "url" };
  if (model === "dall-e-3") {
    requestParams.quality = quality;
    requestParams.style = style;
  }

  const response = await client.images.generate(requestParams);

  if (!response.data?.length) {
    throw new Error("OpenAI returned an empty response.");
  }

  const imageData = response.data[0];
  const imageUrl = imageData.url;
  const revisedPrompt = imageData.revised_prompt || null;

  if (!imageUrl) {
    throw new Error("OpenAI returned no image URL.");
  }

  const destPath = resolvePath(output);
  const outputDir = dirname(destPath);
  mkdirSync(outputDir, { recursive: true });

  if (verbose) {
    process.stderr.write(`Saving image to ${destPath}...\n`);
  }

  await downloadFile(imageUrl, destPath);

  return { filePath: destPath, revisedPrompt };
}
