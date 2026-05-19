import FabricCanvas from "../FabricCanvas";
import MarkdownCanvas from "../MarkdownCanvas";
import SafeZoneOverlay from "./SafeZoneOverlay";
import { MAX_PREVIEW_CSS_W } from "./designerConstants";

export default function DesignerCanvas({
  mode,
  preset,
  fabricRef,
  canvasEl,
  markdownRef,
  bgColor,
  showSafeZone,
  canvasJson,
  setCanvasJson,
  setCanvasSelection,
  handleCanvasStyleSync,
  markdown,
  mdFontSize,
  mdFontFamily,
  userId,
}) {
  const previewScale = Math.min(1, MAX_PREVIEW_CSS_W / preset.w);

  const styles = {
    canvasWrapper: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 },
    hint: { margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.45 },
    canvasScaler: {
      width: "100%",
      overflow: "auto",
      background: "#0f172a",
      borderRadius: 10,
      padding: 16,
    },
  };

  return (
    <div style={styles.canvasWrapper}>
      <p style={styles.hint}>
        {preset.w} × {preset.h}px · 16∶9 — preview scaled to fit; exported image matches this size for crisp playback on TVs.
      </p>
      <div style={styles.canvasScaler}>
        <div
          style={{
            width: preset.w * previewScale,
            height: preset.h * previewScale,
            margin: "0 auto",
            position: "relative",
          }}
        >
          <div
            style={{
              width: preset.w,
              height: preset.h,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            <div style={{ display: mode === "visual" ? "block" : "none" }}>
              <FabricCanvas
                key={`canvas-${userId}`}
                fabricRef={fabricRef}
                canvasEl={canvasEl}
                width={preset.w}
                height={preset.h}
                bgColor={bgColor}
                setSelected={setCanvasSelection}
                onActiveStyleSync={handleCanvasStyleSync}
                initialJson={canvasJson}
                onCanvasChange={setCanvasJson}
              />
              {showSafeZone && <SafeZoneOverlay width={preset.w} height={preset.h} />}
            </div>
            <div style={{ display: mode === "markdown" ? "block" : "none" }}>
              <MarkdownCanvas
                markdown={markdown}
                markdownRef={markdownRef}
                fontSize={mdFontSize}
                fontFamily={mdFontFamily}
                width={preset.w}
                height={preset.h}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
