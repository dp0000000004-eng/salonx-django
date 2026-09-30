/** Brand loading indicator: the SalonX wordmark gently fading in and out. */
export function SalonXLoader({
  fullScreen = false,
  className = "",
}: {
  fullScreen?: boolean;
  className?: string;
}) {
  const wordmark = (
    <span className="salonx-loader-word select-none text-3xl font-extrabold tracking-[0.18em] text-foreground sm:text-4xl">
      SalonX
    </span>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-background ${className}`}
      >
        {wordmark}
      </div>
    );
  }

  return (
    <div role="status" aria-label="Loading" className={`flex w-full items-center justify-center py-16 ${className}`}>
      {wordmark}
    </div>
  );
}

export default SalonXLoader;
