const DB_NAME = 'page-can-assets';
const STORE_NAME = 'assets';
const WALLPAPER_KEY = 'wallpaper';
const FALLBACK_ACCENT = '#5e5ce6';

export interface WallpaperAnalysis {
  accentColor: string;
}

export interface OptimizedWallpaper {
  blob: Blob;
  analysis: WallpaperAnalysis;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function optimizeWallpaper(file: File): Promise<OptimizedWallpaper> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 3840 / bitmap.width, 2160 / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error('Görsel işleme başlatılamadı.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const analysis = analyzeSource(canvas, width, height);
  const blob = await canvasToBlob(canvas);
  return { blob, analysis };
}

export async function analyzeWallpaper(blob: Blob): Promise<WallpaperAnalysis> {
  const bitmap = await createImageBitmap(blob);
  try {
    return analyzeSource(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Görsel dönüştürülemedi.')),
      'image/webp',
      0.86,
    );
  });
}

function analyzeSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): WallpaperAnalysis {
  const sample = document.createElement('canvas');
  sample.width = 56;
  sample.height = 56;
  const context = sample.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return { accentColor: FALLBACK_ACCENT };

  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const buckets = new Map<number, { red: number; green: number; blue: number; weight: number }>();

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const { hue, saturation, lightness } = rgbToHsl(red, green, blue);
    if (saturation < 0.18 || lightness < 0.1 || lightness > 0.9) continue;

    const hueBand = Math.floor(hue * 24) % 24;
    const lightBand = lightness < 0.4 ? 0 : lightness < 0.7 ? 1 : 2;
    const key = hueBand * 3 + lightBand;
    const pixelWeight = (0.35 + saturation * saturation) * (1 - Math.abs(lightness - 0.56) * 0.7);
    const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, weight: 0 };
    bucket.red += red * pixelWeight;
    bucket.green += green * pixelWeight;
    bucket.blue += blue * pixelWeight;
    bucket.weight += pixelWeight;
    buckets.set(key, bucket);
  }

  const winner = [...buckets.values()].sort((left, right) => right.weight - left.weight)[0];
  if (!winner?.weight) return { accentColor: FALLBACK_ACCENT };

  const selected = rgbToHsl(
    winner.red / winner.weight,
    winner.green / winner.weight,
    winner.blue / winner.weight,
  );
  const saturation = Math.min(0.78, Math.max(0.54, selected.saturation * 1.08));
  return { accentColor: hslToHex(selected.hue, saturation, 0.58) };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = max === r
    ? ((g - b) / delta) % 6
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  hue = ((hue * 60 + 360) % 360) / 360;
  return { hue, saturation, lightness };
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue * 6;
  const component = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = sector < 1
    ? [chroma, component, 0]
    : sector < 2
      ? [component, chroma, 0]
      : sector < 3
        ? [0, chroma, component]
        : sector < 4
          ? [0, component, chroma]
          : sector < 5
            ? [component, 0, chroma]
            : [chroma, 0, component];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

export async function saveWallpaper(blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(blob, WALLPAPER_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function getWallpaper(): Promise<Blob | undefined> {
  const database = await openDatabase();
  const result = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(WALLPAPER_KEY);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

export async function removeWallpaper(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(WALLPAPER_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
