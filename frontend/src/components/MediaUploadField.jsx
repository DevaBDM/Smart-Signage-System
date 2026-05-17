import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import api from "../api/axios";
import { mediaSrc } from "./PostMedia";
import VideoTrimSlider from "./VideoTrimSlider";
import * as S from "../styles";

const MIN_TRIM_GAP = 0.5;

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

function toNormalizedCrop(croppedAreaPixels, naturalWidth, naturalHeight) {
  return {
    x: croppedAreaPixels.x / naturalWidth,
    y: croppedAreaPixels.y / naturalHeight,
    width: croppedAreaPixels.width / naturalWidth,
    height: croppedAreaPixels.height / naturalHeight,
  };
}

function captureVideoFrame(video) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function MediaUploadField({ items = [], onChange, max = 10, label }) {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [frameNaturalSize, setFrameNaturalSize] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [frameUrl, setFrameUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const isVideo = draft?.file?.type?.startsWith("video/");

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  useEffect(() => {
    if (!draft?.preview || !isVideo) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const onMeta = () => {
      const d = video.duration || 0;
      setVideoDuration(d);
      setTrimStart(0);
      setTrimEnd(Math.max(0.5, d));
      video.currentTime = Math.min(d / 2, d);
    };
    const onSeeked = () => {
      try {
        setFrameUrl(captureVideoFrame(video));
        setFrameNaturalSize({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      } catch {
        setFrameUrl(null);
        setFrameNaturalSize(null);
      }
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [draft?.preview, isVideo]);

  const closeDraft = () => {
    if (draft?.preview) URL.revokeObjectURL(draft.preview);
    setDraft(null);
    setError("");
    setFrameUrl(null);
    setFrameNaturalSize(null);
    setCroppedAreaPixels(null);
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (items.length >= max) {
      setError(`Maximum ${max} files.`);
      return;
    }
    setError("");
    setDraft({ file, preview: URL.createObjectURL(file) });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const buildCropPayload = async () => {
    if (isVideo) {
      let spatial = { x: 0, y: 0, width: 1, height: 1 };
      if (croppedAreaPixels && frameNaturalSize) {
        spatial = toNormalizedCrop(
          croppedAreaPixels,
          frameNaturalSize.width,
          frameNaturalSize.height,
        );
      }
      return { start: trimStart, end: trimEnd, ...spatial };
    }
    if (!croppedAreaPixels) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }
    const img = await createImage(draft.preview);
    return toNormalizedCrop(croppedAreaPixels, img.naturalWidth, img.naturalHeight);
  };

  const confirmCrop = async () => {
    if (!draft?.file) return;
    setProcessing(true);
    setError("");
    try {
      const cropPayload = await buildCropPayload();
      const fd = new FormData();
      fd.append("file", draft.file);
      fd.append("crop", JSON.stringify(cropPayload));
      const res = await api.post("/media/process", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000,
      });
      onChange([
        ...items,
        { ...res.data, previewUrl: mediaSrc(res.data) },
      ]);
      closeDraft();
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 404
          ? "Upload API not found — restart the backend server."
          : null) ||
        err.message ||
        "Processing failed on server.";
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  const removeItem = (index) => {
    const target = items[index];
    onChange(items.filter((_, i) => i !== index));
    if (target?.image_path) {
      api
        .delete("/media", { data: { image_path: target.image_path } })
        .catch(() => {
          // Best-effort cleanup; UI removal already succeeded.
        });
    }
  };

  return (
    <div>
      {label ? <label style={S.label}>{label}</label> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        {items.map((item, i) => (
          <div key={`${item.image_path}-${i}`} style={thumbWrap}>
            {item.media_type === "VIDEO" ? (
              <video
                src={item.previewUrl || mediaSrc(item)}
                style={{ width: "100%", height: 100, objectFit: "cover" }}
              />
            ) : (
              <img
                src={item.previewUrl || mediaSrc(item)}
                alt=""
                style={{ width: "100%", height: 100, objectFit: "cover" }}
              />
            )}
            {item.media_type === "VIDEO" && item.duration_seconds ? (
              <span style={thumbBadge}>{item.duration_seconds}s</span>
            ) : null}
            <button type="button" onClick={() => removeItem(i)} style={thumbRemove}>
              ×
            </button>
          </div>
        ))}
        {items.length < max ? (
          <button type="button" onClick={() => inputRef.current?.click()} style={addBtn}>
            + Add image or video
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        style={{ display: "none" }}
        onChange={pickFile}
      />

      {error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}

      {draft ? (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <h3 style={{ margin: "0 0 12px", fontWeight: 700 }}>
              {isVideo ? "Trim & crop video" : "Crop image"}
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
              Cropping and trimming are applied on the server after you confirm.
            </p>

            {isVideo ? (
              <>
                <video
                  ref={videoRef}
                  src={draft.preview}
                  controls
                  playsInline
                  style={{ width: "100%", maxHeight: 200, background: "#000" }}
                />
                {videoDuration > 0 ? (
                  <VideoTrimSlider
                    duration={videoDuration}
                    start={trimStart}
                    end={trimEnd}
                    minGap={MIN_TRIM_GAP}
                    onChange={({ start, end }) => {
                      setTrimStart(start);
                      setTrimEnd(end);
                    }}
                  />
                ) : null}
                {frameUrl ? (
                  <div
                    style={{
                      position: "relative",
                      height: 280,
                      marginTop: 12,
                      background: "#111",
                    }}
                  >
                    <Cropper
                      image={frameUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={16 / 9}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div style={{ position: "relative", height: 320, background: "#111" }}>
                  <Cropper
                    image={draft.preview}
                    crop={crop}
                    zoom={zoom}
                    aspect={16 / 9}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <label style={{ ...S.label, marginTop: 8 }}>Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={closeDraft}
                style={cancelBtn}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCrop}
                style={confirmBtn}
                disabled={processing}
              >
                {processing ? "Processing…" : "Apply crop"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCard = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  width: "min(640px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
};

const addBtn = {
  width: 120,
  height: 100,
  border: "2px dashed #d1d5db",
  borderRadius: 8,
  background: "#f9fafb",
  cursor: "pointer",
  fontSize: 12,
  color: "#6b7280",
};

const thumbWrap = {
  position: "relative",
  width: 120,
  height: 100,
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const thumbBadge = {
  position: "absolute",
  bottom: 4,
  left: 4,
  background: "rgba(0,0,0,0.65)",
  color: "#fff",
  fontSize: 10,
  padding: "2px 6px",
  borderRadius: 4,
};

const thumbRemove = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "none",
  background: "#ef4444",
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

const cancelBtn = {
  ...S.btn,
  background: "#f3f4f6",
  color: "#374151",
};

const confirmBtn = {
  ...S.btn,
  background: "#2563eb",
  color: "#fff",
};
