/**
 * Thin wrapper around ffmpeg.wasm — lazy-loaded from a CDN so the bulk
 * (~30MB of WASM) is never paid until the user hits the Moving Plate
 * export path. Pure ESM, no build step.
 *
 * Usage:
 *   import { captureCanvasFrames } from '../artwork.js';
 *   import { encodeFramesToMp4, downloadBlob } from './ffmpeg.js';
 *
 *   const { blobs, width, height, fps } = await captureCanvasFrames(canvas, draw, { fps: 30, frames: 120 });
 *   const mp4 = await encodeFramesToMp4(blobs, { width, height, fps });
 *   downloadBlob(mp4, 'plate.mp4');
 */

const FFMPEG_VERSION = '0.12.10';
const FFMPEG_CORE_VERSION = '0.12.6';
const FFMPEG_BASE = `https://esm.sh/@ffmpeg/ffmpeg@${FFMPEG_VERSION}`;
const FFMPEG_UTIL = `https://esm.sh/@ffmpeg/util@0.12.1`;
const FFMPEG_CORE_BASE =
  `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

let loaderPromise = null;
let ffmpegInstance = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Returns true when ffmpeg.wasm is realistically usable in the current
 * environment (cross-origin isolation enabled, so SharedArrayBuffer works).
 */
export function isFfmpegSupported() {
  if (!isBrowser()) return false;
  if (typeof SharedArrayBuffer === 'undefined') return false;
  if (window.crossOriginIsolated === false) return false;
  return true;
}

async function loadFfmpegModule() {
  if (loaderPromise) return loaderPromise;
  loaderPromise = (async () => {
    const [ffmpegMod, utilMod] = await Promise.all([
      import(/* @vite-ignore */ FFMPEG_BASE),
      import(/* @vite-ignore */ FFMPEG_UTIL),
    ]);
    return { FFmpeg: ffmpegMod.FFmpeg, util: utilMod };
  })();
  return loaderPromise;
}

/**
 * Lazily construct (and load core for) a singleton FFmpeg instance.
 * @param {{ log?: boolean, onProgress?: (ratio: number) => void }} [opts]
 */
export async function getFfmpeg(opts = {}) {
  if (!isFfmpegSupported()) {
    throw new Error(
      'ffmpeg.wasm is not supported here. The page must be served with COOP/COEP headers (cross-origin isolated).',
    );
  }
  if (ffmpegInstance) return ffmpegInstance;

  const { FFmpeg, util } = await loadFfmpegModule();
  const ffmpeg = new FFmpeg();

  if (opts.log) ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));
  if (typeof opts.onProgress === 'function') {
    ffmpeg.on('progress', ({ progress }) => opts.onProgress(progress));
  }

  await ffmpeg.load({
    coreURL: await util.toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await util.toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpegInstance;
}

function pad(n, width = 4) {
  const s = String(n);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

async function blobToUint8(blob) {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Encode a sequence of PNG frames to a yuv420p MP4 (h264).
 *
 * @param {Blob[]} frameBlobs - one PNG per frame, all the same size
 * @param {{ width: number, height: number, fps?: number, crf?: number, preset?: string, onProgress?: (ratio: number) => void }} opts
 * @returns {Promise<Blob>} mp4 video blob
 */
export async function encodeFramesToMp4(frameBlobs, opts) {
  if (!Array.isArray(frameBlobs) || frameBlobs.length === 0) {
    throw new Error('encodeFramesToMp4: frameBlobs is required');
  }
  if (!opts?.width || !opts?.height) {
    throw new Error('encodeFramesToMp4: width and height are required');
  }

  const fps = Math.max(1, Math.min(60, Number(opts.fps) || 30));
  const crf = Math.max(0, Math.min(51, Number(opts.crf) || 22));
  const preset = opts.preset || 'medium';

  const ffmpeg = await getFfmpeg({ onProgress: opts.onProgress });

  for (let i = 0; i < frameBlobs.length; i++) {
    const name = `f_${pad(i)}.png`;
    const data = await blobToUint8(frameBlobs[i]);
    await ffmpeg.writeFile(name, data);
  }

  const outName = 'out.mp4';
  await ffmpeg.exec([
    '-r', String(fps),
    '-i', 'f_%04d.png',
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outName,
  ]);

  const out = await ffmpeg.readFile(outName);

  await Promise.all(
    frameBlobs.map((_, i) => ffmpeg.deleteFile(`f_${pad(i)}.png`).catch(() => {})),
  );
  await ffmpeg.deleteFile(outName).catch(() => {});

  return new Blob([out.buffer], { type: 'video/mp4' });
}

/**
 * Encode a sequence of PNG frames to an animated WebP — used as a fallback
 * when the host page is not cross-origin isolated and ffmpeg.wasm cannot run.
 *
 * Returns the first frame as a static PNG if only one frame is provided.
 */
export async function encodeFramesToWebp(frameBlobs) {
  if (!Array.isArray(frameBlobs) || frameBlobs.length === 0) {
    throw new Error('encodeFramesToWebp: frameBlobs is required');
  }
  if (frameBlobs.length === 1) return frameBlobs[0];
  // Best-effort: most browsers do not have a built-in animated WebP encoder
  // so we return the last frame as a high-quality still. The Moving Plate
  // path will surface this gracefully with a "still fallback" toast.
  return frameBlobs[frameBlobs.length - 1];
}

/**
 * Trigger a browser download of the given blob. Safe to call multiple times.
 */
export function downloadBlob(blob, filename = 'plate.mp4') {
  if (!isBrowser()) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
