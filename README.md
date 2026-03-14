# dalle-gen

A CLI tool for generating images with OpenAI DALL-E. Supports post-processing
(resize and center-crop) via [sharp](https://sharp.pixelplumbing.com/).

## Install

```bash
git clone https://github.com/xransum/dalle-gen
cd dalle-gen
npm install
npm install -g .
```

To update after pulling changes:

```bash
git pull
npm install -g .
```

## Requirements

Set your OpenAI API key in the environment:

```bash
export OPENAI_API_KEY="sk-..."
```

## CLI usage

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
  --help, -h            Show help
```

### Examples

```bash
# Basic generation
dalle-gen --output ./hero.png "a photorealistic mountain at sunset"

# High-quality wide banner
dalle-gen -o ./art.png --size 1792x1024 --quality hd "abstract neon cityscape"

# Using dall-e-2 at a smaller size
dalle-gen -o ./sketch.png --model dall-e-2 --size 512x512 "a cute robot"

# Generate and resize to favicon dimensions
dalle-gen -o ./favicon.png --resize 64x64 "a minimalist geometric logo"

# Generate and center-crop to a square avatar
dalle-gen -o ./avatar.png --crop 256x256 "a portrait of a robot"
```

## Post-processing

`--resize` and `--crop` are applied after the image is downloaded. When both
are specified, crop runs first, then resize.

- `--resize <WxH>` -- scale the image to exact dimensions (stretches if aspect
  ratio differs)
- `--crop <WxH>` -- extract a centered region of the given dimensions; errors
  if the crop area is larger than the source image

## Troubleshooting

**`Error: OPENAI_API_KEY environment variable is not set.`**
Export your API key before running: `export OPENAI_API_KEY="sk-..."`. If your
key lives in a `.envrc` or `.zshrc`, make sure it is sourced in the shell
session where you run `dalle-gen`.

**`Error: Invalid size "..." for dall-e-2.`**
`dall-e-2` only supports `256x256`, `512x512`, and `1024x1024`. The larger
sizes (`1792x1024`, `1024x1792`) are `dall-e-3` only.

**`Error: Invalid model "...".`**
Valid models are `dall-e-2` and `dall-e-3`.

**Content policy refusal**
If your prompt is refused by the OpenAI content policy, the API returns an
error with a message explaining the refusal. Rephrase the prompt and retry.

## Development

```bash
npm test          # run unit tests
npm run lint      # check for lint errors
npm run lint:fix  # auto-fix lint errors
npm run format    # format all files with Prettier
```

## License

MIT
