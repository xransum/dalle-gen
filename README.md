# dalle-gen

CLI tool for generating images with OpenAI DALL-E. Supports post-processing (resize and center-crop) via [sharp](https://sharp.pixelplumbing.com/).

## Install

```bash
npm install -g dalle-gen
```

Requires Node.js >= 18 and an [OpenAI API key](https://platform.openai.com/api-keys).

## Setup

```bash
export OPENAI_API_KEY="sk-..."
```

## Usage

```
dalle-gen [options] <prompt>

Options:
  --output, -o <path>   Destination file path (required)
  --model <model>       dall-e-2 | dall-e-3  (default: dall-e-3)
  --size <WxH>          Image dimensions (default: 1024x1024)
                        dall-e-3: 1024x1024 | 1792x1024 | 1024x1792
                        dall-e-2: 256x256   | 512x512   | 1024x1024
  --quality <quality>   standard | hd  (default: standard, dall-e-3 only)
  --style <style>       vivid | natural  (default: vivid, dall-e-3 only)
  --resize <WxH>        Resize output image after generation (e.g. 64x64)
  --crop <WxH>          Center-crop output image after generation (e.g. 32x32)
  --verbose, -v         Print progress info to stderr
  --help, -h            Show this help message
```

## Examples

```bash
# Basic generation
dalle-gen --output ./hero.png "a photorealistic mountain at sunset"

# High-quality wide banner
dalle-gen -o ./banner.png --size 1792x1024 --quality hd "abstract neon cityscape"

# DALL-E 2 at a smaller size
dalle-gen -o ./sketch.png --model dall-e-2 --size 512x512 "a cute robot"

# Generate then resize to favicon dimensions
dalle-gen -o ./favicon.png --resize 64x64 "a minimalist geometric logo"

# Generate then center-crop to a square avatar
dalle-gen -o ./avatar.png --crop 256x256 "a portrait of a robot"
```

## Post-processing

`--resize` and `--crop` are applied after the image is downloaded. When both are specified, crop runs first, then resize.

- `--resize <WxH>` -- scale to exact dimensions (stretches if aspect ratio differs)
- `--crop <WxH>` -- extract a centered region; errors if crop area exceeds the source image

## Output format

Each successful run prints key:value lines to stdout:

```
saved: /absolute/path/to/image.png
revised_prompt: <OpenAI's revised version of your prompt, if any>
```

`revised_prompt` is only printed when DALL-E 3 rewrites the prompt.

## Troubleshooting

**`Error: OPENAI_API_KEY environment variable is not set.`**
Export your API key before running. If it lives in a `.envrc` or `.zshrc`, make sure it is sourced in the current shell session.

**`Error: Invalid size "..." for dall-e-2.`**
`dall-e-2` only supports `256x256`, `512x512`, and `1024x1024`. The wider sizes are `dall-e-3` only.

**Content policy refusal**
The API returns an error message explaining the refusal. Rephrase the prompt and retry.

## Development

```bash
npm test              # run tests
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix lint errors
npm run format        # format all files with Prettier
npm run format:check  # check formatting without writing
```

## License

MIT
