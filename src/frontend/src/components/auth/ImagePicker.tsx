import { useRef, useState, type DragEvent } from 'react';

/**
 * Avatar/logo picker: accepts an image, center-crops to a square, resizes to
 * 384px and emits a compact JPEG data URL (well under the backend's size cap).
 */
export function ImagePicker({
  value,
  onChange,
  label,
  shape = 'circle',
  hint,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  label: string;
  shape?: 'circle' | 'rounded';
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) { setError('Välj en bildfil (JPG, PNG eller WebP)'); return; }
    if (file.size > 12 * 1024 * 1024) { setError('Bilden är för stor (max 12 MB)'); return; }
    setBusy(true);
    try {
      const dataUrl = await resizeToSquareJpeg(file, 384);
      onChange(dataUrl);
    } catch {
      setError('Bilden kunde inte läsas — prova en annan fil');
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
          <img src={value} alt="" className={`upload-prev ${shape}`} />
        ) : (
          <div className={`upload-ph ${shape}`} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L7 22" />
            </svg>
          </div>
        )}
        <div className="upload-txt">
          <strong>{busy ? 'Bearbetar…' : value ? 'Byt bild' : 'Ladda upp bild'}</strong>
          <span>{hint ?? 'Klicka eller släpp en bild här · JPG, PNG, WebP'}</span>
        </div>
        {value && (
          <button
            type="button"
            className="upload-rm"
            aria-label="Ta bort bild"
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
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void processFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

async function resizeToSquareJpeg(file: File, size: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    // White backdrop so transparent PNGs don't turn black in JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
