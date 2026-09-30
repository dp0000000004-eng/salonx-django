import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { resolveMediaUrl } from "@/lib/media";

/** Resolves a stored media path (or absolute URL) into a viewable URL. */
export function useMediaUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!path) return;
    void resolveMediaUrl(path).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

/**
 * Image for anything stored in SalonX media storage. Falls back to a neutral
 * placeholder instead of a fake photo when the file cannot be loaded.
 * Keeps the box reserved and fades the photo in, so nothing shifts on load.
 */
export function StoredImage({
  path,
  alt,
  className = "",
  fit = "cover",
  fallback,
  eager = false,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  fallback?: React.ReactNode;
  eager?: boolean;
}) {
  const url = useMediaUrl(path);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!path || failed) {
    return (
      <span className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        {fallback ?? <ImageOff className="size-5 opacity-60" aria-hidden />}
        <span className="sr-only">{alt}</span>
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden bg-muted ${className}`}>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />}
      {url && (
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          data-loaded={loaded ? "true" : "false"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`sx-img size-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        />
      )}
    </span>
  );
}
