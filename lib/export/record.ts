/**
 * Turn the board that is already on screen into a video file.
 *
 * The alternative was a second renderer that draws the scene straight to a
 * canvas — and then every change to a token, a trace or the pitch would have to
 * be made twice, in two languages, forever. Instead this rasterises the live
 * SVG frame by frame while the ordinary playback runs, so whatever the board
 * shows is exactly what the file contains.
 */

/** MP4 first: it is what WhatsApp, iOS and Android all take without converting. */
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export type RecordResult = { blob: Blob; extension: string };

export function canRecord() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMime() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/**
 * The pitch is the only part of the board painted from CSS variables; a
 * standalone SVG has no cascade to read them from, so they are resolved here and
 * written in as literals. Longest name first — "--court-face" contains
 * "--court".
 */
function inlineTheme(markup: string) {
  const css = getComputedStyle(document.documentElement);
  const vars = ["--court-face", "--court"];
  let out = markup;
  for (const name of vars) {
    const value = css.getPropertyValue(name).trim() || "#17302e";
    out = out.split(`var(${name})`).join(value);
  }
  // Token labels ask for the app font, which the file cannot load either.
  return out.replace(/var\(--font-sans\),\s*/g, "");
}

function serialise(svg: SVGSVGElement, width: number, height: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("style");
  return inlineTheme(new XMLSerializer().serializeToString(clone));
}

async function rasterise(markup: string): Promise<CanvasImageSource> {
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Safari has historically refused SVG here; fall through to an <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("frame failed to rasterise"));
      img.src = url;
    });
    return img;
  } finally {
    // Revoking immediately is safe: decoding has already finished above.
    URL.revokeObjectURL(url);
  }
}

/**
 * Records for `durationMs` of wall-clock time. The caller starts the normal
 * playback first; this only watches. Frames are pulled as fast as rasterising
 * allows rather than on a fixed clock, so a slow machine produces a shorter
 * frame count, never a video that drifts out of time with the movement.
 */
export async function recordBoard(
  svg: SVGSVGElement,
  durationMs: number,
  options: { width?: number; fps?: number } = {},
): Promise<RecordResult> {
  if (!canRecord()) throw new Error("Este browser não consegue gravar vídeo.");

  const box = svg.viewBox.baseVal;
  const width = options.width ?? 1080;
  // Even dimensions: H.264 refuses odd ones.
  const height = Math.round((width * box.height) / box.width / 2) * 2;
  const fps = options.fps ?? 25;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este browser não consegue gravar vídeo.");

  const mime = pickMime();
  const recorder = new MediaRecorder(canvas.captureStream(fps), {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
  });

  recorder.start();

  const started = performance.now();
  let running = true;
  while (running) {
    const frame = await rasterise(serialise(svg, width, height));
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(frame, 0, 0, width, height);
    if (typeof ImageBitmap !== "undefined" && frame instanceof ImageBitmap) frame.close();

    if (performance.now() - started >= durationMs) running = false;
    else await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  recorder.stop();
  const blob = await done;
  return { blob, extension: (mime || "video/webm").includes("mp4") ? "mp4" : "webm" };
}

/** Hand the file to the browser under a name the coach will recognise later. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Saída de 4" -> "saida-de-4", so the file survives a trip through WhatsApp. */
export function slugify(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "quadra"
  );
}
