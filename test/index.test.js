import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run bin/dalle-gen.js in-process by dynamically importing it with a patched
 * argv and capturing stdout/stderr. We cannot import it directly (it calls
 * main() at module load and is not idempotent), so we spawn a child process
 * instead using node:child_process.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, "../bin/dalle-gen.js");
const SRC_GENERATE = path.resolve(__dirname, "../src/generate.js");
const SRC_TRANSFORM = path.resolve(__dirname, "../src/transform.js");

async function runCLI(args, env = {}) {
  try {
    const result = await execFileAsync(process.execPath, [BIN, ...args], {
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

describe("CLI argument parsing", () => {
  it("prints help and exits 0 with --help", async () => {
    const { code, stdout } = await runCLI(["--help"]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: dalle-gen/);
  });

  it("prints help and exits 0 with -h", async () => {
    const { code, stdout } = await runCLI(["-h"]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: dalle-gen/);
  });

  it("exits 1 when no prompt is given", async () => {
    const { code, stderr } = await runCLI(["--output", "/tmp/test.png"]);
    assert.equal(code, 1);
    assert.match(stderr, /prompt is required/i);
  });

  it("exits 1 when --output is missing", async () => {
    const { code, stderr } = await runCLI(["a cool image"]);
    assert.equal(code, 1);
    assert.match(stderr, /--output/i);
  });

  it("exits 1 for an unknown flag", async () => {
    const { code, stderr } = await runCLI(["--unknown-flag", "--output", "/tmp/x.png", "prompt"]);
    assert.equal(code, 1);
    assert.match(stderr, /unknown/i);
  });

  it("exits 1 for invalid --resize format", async () => {
    const { code, stderr } = await runCLI([
      "--output", "/tmp/x.png",
      "--resize", "notadimension",
      "some prompt",
    ], { OPENAI_API_KEY: "sk-fake" });
    assert.equal(code, 1);
    assert.match(stderr, /WxH/i);
  });

  it("exits 1 for invalid --crop format", async () => {
    const { code, stderr } = await runCLI([
      "--output", "/tmp/x.png",
      "--crop", "abc",
      "some prompt",
    ], { OPENAI_API_KEY: "sk-fake" });
    assert.equal(code, 1);
    assert.match(stderr, /WxH/i);
  });
});

// ---------------------------------------------------------------------------
// generateImage validation (unit -- no network calls)
// ---------------------------------------------------------------------------

describe("generateImage input validation", async () => {
  const { generateImage } = await import(SRC_GENERATE);

  it("throws when prompt is empty", async () => {
    await assert.rejects(
      () => generateImage({ prompt: "", output: "/tmp/x.png" }),
      /prompt is required/i
    );
  });

  it("throws when output is empty", async () => {
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "" }),
      /output path is required/i
    );
  });

  it("throws when OPENAI_API_KEY is not set", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await assert.rejects(
        () => generateImage({ prompt: "hello", output: "/tmp/x.png" }),
        /OPENAI_API_KEY/i
      );
    } finally {
      if (saved !== undefined) {process.env.OPENAI_API_KEY = saved;}
    }
  });

  it("throws when OPENAI_API_KEY is whitespace only", async () => {
    const saved = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "   ";
    try {
      await assert.rejects(
        () => generateImage({ prompt: "hello", output: "/tmp/x.png" }),
        /OPENAI_API_KEY/i
      );
    } finally {
      process.env.OPENAI_API_KEY = saved ?? "";
      if (!saved) {delete process.env.OPENAI_API_KEY;}
    }
  });

  it("throws on invalid model", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "/tmp/x.png", model: "dall-e-99" }),
      /invalid model/i
    );
  });

  it("throws on invalid size for dall-e-3", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "/tmp/x.png", model: "dall-e-3", size: "512x512" }),
      /invalid size/i
    );
  });

  it("throws on invalid size for dall-e-2", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "/tmp/x.png", model: "dall-e-2", size: "1792x1024" }),
      /invalid size/i
    );
  });

  it("throws on invalid quality", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "/tmp/x.png", model: "dall-e-3", size: "1024x1024", quality: "ultra" }),
      /invalid quality/i
    );
  });

  it("throws on invalid style", async () => {
    process.env.OPENAI_API_KEY = "sk-fake";
    await assert.rejects(
      () => generateImage({ prompt: "hello", output: "/tmp/x.png", model: "dall-e-3", size: "1024x1024", style: "impressionist" }),
      /invalid style/i
    );
  });
});

// ---------------------------------------------------------------------------
// resizeImage (unit -- uses a real tiny PNG fixture)
// ---------------------------------------------------------------------------

describe("resizeImage", async () => {
  const { resizeImage } = await import(SRC_TRANSFORM);

  let tmpFile;

  beforeEach(async () => {
    // Create a 100x100 solid-red PNG using sharp itself as a fixture.
    const { default: sharp } = await import("sharp");
    tmpFile = path.join(os.tmpdir(), `dalle-gen-test-${Date.now()}.png`);
    await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toFile(tmpFile);
  });

  afterEach(() => {
    if (fs.existsSync(tmpFile)) {fs.unlinkSync(tmpFile);}
  });

  it("resizes image to target dimensions", async () => {
    const { default: sharp } = await import("sharp");
    await resizeImage({ filePath: tmpFile, resize: { width: 32, height: 32 } });
    const meta = await sharp(tmpFile).metadata();
    assert.equal(meta.width, 32);
    assert.equal(meta.height, 32);
  });

  it("center-crops image to target dimensions", async () => {
    const { default: sharp } = await import("sharp");
    await resizeImage({ filePath: tmpFile, crop: { width: 50, height: 50 } });
    const meta = await sharp(tmpFile).metadata();
    assert.equal(meta.width, 50);
    assert.equal(meta.height, 50);
  });

  it("applies crop then resize when both are specified", async () => {
    const { default: sharp } = await import("sharp");
    await resizeImage({
      filePath: tmpFile,
      crop:   { width: 80, height: 80 },
      resize: { width: 16, height: 16 },
    });
    const meta = await sharp(tmpFile).metadata();
    assert.equal(meta.width, 16);
    assert.equal(meta.height, 16);
  });

  it("throws when crop dimensions exceed image size", async () => {
    await assert.rejects(
      () => resizeImage({ filePath: tmpFile, crop: { width: 200, height: 200 } }),
      /exceed image dimensions/i
    );
  });

  it("is a no-op when neither resize nor crop is given", async () => {
    const { default: sharp } = await import("sharp");
    await resizeImage({ filePath: tmpFile });
    const meta = await sharp(tmpFile).metadata();
    assert.equal(meta.width, 100);
    assert.equal(meta.height, 100);
  });
});
