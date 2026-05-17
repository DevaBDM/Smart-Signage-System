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
}) {
  const src = mediaSrc(item);
  if (!src) return null;

  if (item.media_type === "VIDEO") {
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
    <img src={src} alt={alt} style={{ width: "100%", display: "block", ...style }} {...imgProps} />
  );
}
