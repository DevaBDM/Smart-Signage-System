import { assetOrigin } from "../config/apiBase";

const origin = assetOrigin();

export function mediaSrc(item) {
  if (!item?.image_path) return "";
  return item.image_path.startsWith("http")
    ? item.image_path
    : `${origin}${item.image_path}`;
}

export default function PostMedia({
  item,
  alt = "",
  style = {},
  videoProps = {},
  imgProps = {},
  /** Feed/card: no controls; clicks pass through to parent link */
  preview = false,
  /** For LIVE_STREAM: the actual stream URL (e.g. relay_url) */
  streamUrl = "",
}) {
  const src = mediaSrc(item);

  // LIVE_STREAM: thumbnail + badge in preview, native video in full mode
  if (streamUrl && (item?.media_type === "LIVE_STREAM" || !item)) {
    if (preview) {
      const thumbSrc = src || streamUrl;
      return (
        <div style={{ position: "relative", width: "100%", ...style }}>
          <img
            src={thumbSrc}
            alt={alt}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "#ef4444",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            LIVE
          </span>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              color: "#fff",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
            aria-hidden
          >
            ▶
          </span>
        </div>
      );
    }
    return (
      <video
        src={streamUrl}
        controls
        playsInline
        autoPlay
        muted={false}
        style={{ width: "100%", display: "block", ...style }}
        {...videoProps}
      />
    );
  }

  if (!src) return null;

  if (item?.media_type === "VIDEO") {
    if (preview) {
      return (
        <div style={{ position: "relative", width: "100%", ...style }}>
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
              pointerEvents: "none",
            }}
            {...videoProps}
          />
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              color: "#fff",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
            aria-hidden
          >
            ▶
          </span>
        </div>
      );
    }
    return (
      <video
        src={src}
        controls
        playsInline
        style={{ width: "100%", display: "block", ...style }}
        {...videoProps}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ width: "100%", display: "block", ...style }}
      {...imgProps}
    />
  );
}
