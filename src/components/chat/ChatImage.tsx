import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isShareAbort, savePhotoToDevice } from '@/lib/savePhoto';

export const CHAT_BUCKET = 'chat-images';

const urlCache = new Map<string, string>();

/** Bilde i chatten — henter signert URL og åpner fullskjerm ved trykk. */
export function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(urlCache.get(path) ?? null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (url) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 60 * 60 * 6);
      if (cancelled || !data?.signedUrl) return;
      urlCache.set(path, data.signedUrl);
      setUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [path, url]);

  const save = async () => {
    if (!url) return;
    setSaving(true);
    try {
      const result = await savePhotoToDevice(url, 'lederhuset.jpg');
      toast.success(result === 'shared' ? 'Velg «Lagre bilde»' : 'Bildet er lastet ned');
    } catch (e) {
      if (!isShareAbort(e)) toast.error('Kunne ikke lagre bildet');
    } finally {
      setSaving(false);
    }
  };

  if (!url) {
    return (
      <div className="flex h-40 w-52 items-center justify-center rounded-xl bg-muted/60">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        <img
          src={url}
          alt="Bilde i chatten"
          loading="lazy"
          className="max-h-64 w-auto max-w-full rounded-xl object-cover"
        />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
            <div
              className="flex items-center justify-between p-3"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-full bg-white/10 p-2 text-white disabled:opacity-50"
                aria-label="Lagre bilde"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center p-3">
              <img src={url} alt="Bilde i chatten" className="max-h-full max-w-full object-contain" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
