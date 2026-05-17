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
}) {
  const src = mediaSrc(item);
  if (!src) return null;

  if (item.media_type === "VIDEO") {
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
