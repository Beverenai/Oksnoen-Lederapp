/**
 * Lagre bilder til telefonens bilde-app.
 *
 * iOS ignorerer <a download>, så vi bruker delearket i stedet:
 *  - Native app (Capacitor): skriv til cache med Filesystem + Share -> «Lagre bilde»
 *  - Safari/PWA: navigator.share({ files }) -> «Lagre bilde»
 *  - Ellers: vanlig nedlasting (desktop)
 */
import { isCapacitor } from '@/lib/capacitor';

export type SaveResult = 'shared' | 'downloaded';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Klarte ikke lese bildet'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Klarte ikke hente bildet');
  return res.blob();
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** True når enheten kan dele filer (og dermed lagre i Bilder). */
export function canSaveToPhotos(): boolean {
  if (isCapacitor()) return true;
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob([new Uint8Array([1])], { type: 'image/jpeg' })], 'p.jpg', {
      type: 'image/jpeg',
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Del/lagre én eller flere filer. Kaster ikke ved brukeravbrudd. */
async function shareFiles(
  items: { blob: Blob; filename: string }[],
  title: string,
): Promise<SaveResult> {
  if (isCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const uris: string[] = [];
    for (const item of items) {
      const data = await blobToBase64(item.blob);
      const written = await Filesystem.writeFile({
        path: item.filename,
        data,
        directory: Directory.Cache,
      });
      uris.push(written.uri);
    }
    if (uris.length === 1) await Share.share({ title, url: uris[0] });
    else await Share.share({ title, files: uris });
    return 'shared';
  }

  const files = items.map(
    (item) => new File([item.blob], item.filename, { type: item.blob.type || 'image/jpeg' }),
  );
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title });
    return 'shared';
  }

  items.forEach((item) => download(item.blob, item.filename));
  return 'downloaded';
}

/** Lagre ett bilde til Bilder (eller last ned på desktop). */
export async function savePhotoToDevice(url: string, filename: string): Promise<SaveResult> {
  const blob = await fetchBlob(url);
  return shareFiles([{ blob, filename }], 'Øksnøen POV');
}

/**
 * Lagre flere bilder i puljer — iOS lagrer en hel pulje til Bilder om gangen.
 * `onProgress` gir antall ferdige bilder.
 */
export async function savePhotosToDevice(
  photos: { url: string; filename: string }[],
  options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<SaveResult> {
  const batchSize = options.batchSize ?? 10;
  let result: SaveResult = 'downloaded';
  let done = 0;
  for (let i = 0; i < photos.length; i += batchSize) {
    const chunk = photos.slice(i, i + batchSize);
    const items = await Promise.all(
      chunk.map(async (p) => ({ blob: await fetchBlob(p.url), filename: p.filename })),
    );
    result = await shareFiles(items, 'Øksnøen POV');
    done += chunk.length;
    options.onProgress?.(done, photos.length);
  }
  return result;
}

/** Brukeren trykket «Avbryt» i delearket — ikke en feil. */
export function isShareAbort(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  const msg = (e?.message ?? '').toLowerCase();
  return e?.name === 'AbortError' || msg.includes('abort') || msg.includes('cancel');
}
