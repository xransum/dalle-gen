#!/usr/bin/env node

/**
 * dalle-gen - CLI for generating images with OpenAI DALL-E.
 *
 * Usage:
 *   dalle-gen [options] <prompt>
 *
 * Options:
 *   --output, -o <path>      Destination file path (required)
 *   --model <model>          DALL-E model: dall-e-2 | dall-e-3 (default: dall-e-3)
 *   --size <WxH>             Image size (default: 1024x1024)
 *                            dall-e-3: 1024x1024 | 1792x1024 | 1024x1792
 *                            dall-e-2: 256x256 | 512x512 | 1024x1024
 *   --quality <quality>      standard | hd (default: standard, dall-e-3 only)
 *   --style <style>          vivid | natural (default: vivid, dall-e-3 only)
 *   --resize <WxH>           Resize the output image after generation (e.g. 64x64)
 *   --crop <WxH>             Center-crop the output image after generation (e.g. 32x32)
 *   --verbose, -v            Print progress info to stderr
 *   --help, -h               Show this help message
 */

import { parseArgs } from "node:util";
import { generateImage } from "../src/generate.js";
import { resizeImage } from "../src/transform.js";

function printHelp() {
  console.log(`
Usage: dalle-gen [options] <prompt>

Generate an image using OpenAI DALL-E and save it to disk.

Options:
  --output, -o <path>      Destination file path (required)
  --model <model>          dall-e-2 | dall-e-3  (default: dall-e-3)
  --size <WxH>             Image dimensions (default: 1024x1024)
                           dall-e-3: 1024x1024 | 1792x1024 | 1024x1792
                           dall-e-2: 256x256   | 512x512   | 1024x1024
  --quality <quality>      standard | hd  (default: standard, dall-e-3 only)
  --style <style>          vivid | natural  (default: vivid, dall-e-3 only)
  --resize <WxH>           Resize output image after generation (e.g. 64x64)
  --crop <WxH>             Center-crop output image after generation (e.g. 32x32)
  --verbose, -v            Print progress info to stderr
  --help, -h               Show this help message

Environment:
  OPENAI_API_KEY           Your OpenAI API key (required)

Examples:
  dalle-gen --output ./hero.png "a photorealistic mountain at sunset"
  dalle-gen -o ./art.png --size 1792x1024 --quality hd "abstract neon cityscape"
  dalle-gen -o ./sketch.png --model dall-e-2 --size 512x512 "a cute robot"
  dalle-gen -o ./favicon.png --resize 64x64 "a minimalist geometric logo"
  dalle-gen -o ./avatar.png --crop 128x128 "a portrait of a robot"
`);
}

function parseDimensions(value, flag) {
  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    console.error(`Error: ${flag} must be in WxH format (e.g. 64x64). Got: "${value}"`);
    process.exit(1);
  }
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

async function main() {
  let values, positionals;

  try {
    ({ values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        output:  { type: "string", short: "o" },
        model:   { type: "string", default: "dall-e-3" },
        size:    { type: "string", default: "1024x1024" },
        quality: { type: "string", default: "standard" },
        style:   { type: "string", default: "vivid" },
        resize:  { type: "string" },
        crop:    { type: "string" },
        verbose: { type: "boolean", short: "v", default: false },
        help:    { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (err) {
    console.error(`Error: ${String(err?.message ?? err)}`);
    process.exit(1);
  }

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const prompt = positionals.join(" ").trim();

  if (!prompt) {
    console.error("Error: A prompt is required.\n");
    printHelp();
    process.exit(1);
  }

  if (!values.output) {
    console.error("Error: --output <path> is required.\n");
    printHelp();
    process.exit(1);
  }

  const resize = values.resize ? parseDimensions(values.resize, "--resize") : null;
  const crop   = values.crop   ? parseDimensions(values.crop,   "--crop")   : null;

  try {
    const { filePath, revisedPrompt } = await generateImage({
      prompt,
      output:   values.output,
      model:    values.model,
      size:     values.size,
      quality:  values.quality,
      style:    values.style,
      verbose:  values.verbose,
    });

    if (resize || crop) {
      await resizeImage({
        filePath,
        resize,
        crop,
        verbose: values.verbose,
      });
    }

    // Line-based key:value output for programmatic consumers.
    console.log(`saved: ${filePath}`);
    if (revisedPrompt) {
      console.log(`revised_prompt: ${revisedPrompt}`);
    }
  } catch (err) {
    console.error(`Error: ${String(err?.message ?? err)}`);
    process.exit(1);
  }
}

main();
