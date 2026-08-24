/** Table / receipt QR. Uses a public encoder when online; the URL is always shown. */
export function QrMark({
  value,
  size = 176,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
  return (
    <figure className="inline-flex flex-col items-center gap-2">
      <img
        src={src}
        width={size}
        height={size}
        alt={caption ?? "QR code"}
        className="rounded-lg border border-border bg-white p-1"
      />
      {caption ? (
        <figcaption className="max-w-[16rem] text-center text-[11px] text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
