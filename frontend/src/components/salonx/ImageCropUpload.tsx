import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { ImagePlus, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { ASPECTS, prepareImage, readableSize, type AspectName, type CropArea } from "@/lib/image";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"];

type Props = {
  label: string;
  aspect?: AspectName;
  value?: string | null;
  previewUrl?: string | null;
  /** Receives the cropped, compressed file. Must upload it and persist the returned path. */
  onUpload: (file: File) => Promise<void>;
  onRemove?: (() => Promise<void> | void) | undefined;
  disabled?: boolean;
  hint?: string;
  /** How the small preview thumbnail shows the image. */
  fit?: "cover" | "contain";
  /** Size/shape of the small preview thumbnail. */
  previewClassName?: string;
};

/** Select → preview → crop → zoom → confirm → compress → upload, with progress, retry and errors. */
export function ImageCropUpload({
  label,
  aspect = "square",
  value,
  previewUrl,
  onUpload,
  onRemove,
  disabled,
  hint,
  fit = "cover",
  previewClassName = "size-20",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = previewUrl ?? value ?? null;

  const onCropComplete = useCallback((_: unknown, pixels: CropArea) => setArea(pixels), []);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setError("Please choose a JPG, PNG, WebP or HEIC image.");
    if (f.size > MAX_INPUT_BYTES) return setError("That image is larger than 20 MB. Please choose a smaller one.");
    setFile(f);
    setSrc(URL.createObjectURL(f));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  function close() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setFile(null);
    setArea(null);
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImage(file, { crop: area ?? undefined });
      await onUpload(prepared);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className={`shrink-0 overflow-hidden rounded-lg border border-border bg-muted ${previewClassName}`}>
          {shown ? (
            <img src={shown} alt={label} className={`size-full ${fit === "contain" ? "object-contain" : "object-cover"}`} loading="lazy" />

          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
          >
            {shown ? "Replace" : "Upload"}
          </button>
          {shown && onRemove && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void onRemove()}
              className="flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <Trash2 className="size-3" /> Remove
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Crop {label.toLowerCase()}</h3>
              <button type="button" onClick={close} disabled={busy} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="relative h-64 w-full bg-muted">
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={ASPECTS[aspect]}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="space-y-3 px-4 py-3">
              <label className="block text-[11px] text-muted-foreground">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-1 w-full accent-primary"
                />
              </label>
              {file && <p className="text-[11px] text-muted-foreground">Original {readableSize(file.size)} — will be optimised before upload.</p>}
              {error && <p className="text-[11px] text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  <RotateCcw className="size-3" /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-3 animate-spin" />}
                  {busy ? "Uploading…" : error ? "Retry" : "Confirm & upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
