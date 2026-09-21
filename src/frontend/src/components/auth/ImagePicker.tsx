import { useRef, useState, type DragEvent } from 'react';
import { t } from '@/lib/i18n';

/**
 * Image picker for avatars, logos and covers: accepts an image, center-crops
 * it to the requested aspect ratio, resizes it and emits a compact JPEG data
 * URL (well under the backend's size cap).
 *
 * aspect 1 (default) → 384×384 square. aspect 3 → 1200×400 wide cover.
 */
export function ImagePicker({
  value,
  onChange,
  label,
  shape = 'circle',
  hint,
  capture,
  aspect = 1,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  label: string;
  shape?: 'circle' | 'rounded' | 'wide';
  hint?: string;
  capture?: boolean;
  /** width / height of the stored image; 1 = square, 3 = cover banner */
  aspect?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const width = aspect > 1 ? 1200 : 384;
  const height = Math.round(width / aspect);

  const processFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) { setError(t('Välj en bildfil (JPG, PNG eller WebP)')); return; }
    if (file.size > 12 * 1024 * 1024) { setError(t('Bilden är för stor (max 12 MB)')); return; }
    setBusy(true);
    try {
      const dataUrl = await resizeToJpeg(file, width, height);
      onChange(dataUrl);
    } catch {
      const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      setError(isHeic
        ? t('iPhone-bilder i HEIC-format stöds inte av webbläsaren — spara om bilden som JPG/PNG och försök igen')
        : t('Bilden kunde inte läsas — prova en JPG- eller PNG-fil'));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const previewStyle = shape === 'wide' ? { width: 120, height: 40, borderRadius: 8 } : undefined;

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className={`upload-zone${value ? ' has' : ''}${dragOver ? ' drag' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {value ? (
          <img src={value} alt="" className={`upload-prev ${shape === 'wide' ? 'rounded' : shape}`} style={previewStyle} />
        ) : (
          <div className={`upload-ph ${shape === 'wide' ? 'rounded' : shape}`} style={previewStyle} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L7 22" />
            </svg>
          </div>
        )}
        <div className="upload-txt">
          <strong>{busy ? t('Bearbetar…') : value ? t('Byt bild') : t('Ladda upp bild')}</strong>
          <span>{hint ?? t('Klicka eller släpp en bild här · JPG, PNG, WebP')}</span>
        </div>
        {value && (
          <button
            type="button"
            className="upload-rm"
            aria-label={t('Ta bort bild')}
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {error && <p className="auth-err" style={{ marginTop: 6 }}>{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'user' as const } : {})}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

async function resizeToJpeg(file: File, width: number, height: number): Promise<string> {
  // FileReader → data URL instead of URL.createObjectURL: the production CSP
  // allows img-src data: but not blob:, so a blob URL never decodes there.
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('decode failed'));
    el.src = sourceUrl;
  });
  // Centre-crop to the target aspect, then scale.
  const target = width / height;
  const source = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth, sh = img.naturalHeight;
  if (source > target) sw = Math.round(img.naturalHeight * target); else sh = Math.round(img.naturalWidth / target);
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  // White backdrop so transparent PNGs don't turn black in JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', width > 400 ? 0.8 : 0.85);
}
