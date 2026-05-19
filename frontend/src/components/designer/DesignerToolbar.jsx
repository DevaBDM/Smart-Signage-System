import { COLORS, BG_SWATCH, FONTS, colorPickerHex } from "./designerConstants";

export default function DesignerToolbar({
  mode,
  selected,
  text,
  fontSize,
  fontFamily,
  textColor,
  bold,
  italic,
  bgColor,
  strokeColor,
  exportJpeg,
  markdown,
  mdFontSize,
  mdFontFamily,
  onModeChange,
  onTextChange,
  onFontSizeChange,
  onFontFamilyChange,
  onToggleBold,
  onToggleItalic,
  onApplyFill,
  onApplyStroke,
  onBgChange,
  onExportJpegChange,
  onTemplate,
  onAddText,
  onAddRect,
  onAddCircle,
  onAddImage,
  onDelete,
  onBringForward,
  onSendBackward,
  onClear,
  onExport,
  onMarkdownChange,
  onMdFontSizeChange,
  onMdFontFamilyChange,
}) {
  const styles = {
    toolbar: {
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      background: "#fff",
      borderRadius: 10,
      padding: "12px 16px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      alignItems: "flex-end",
    },
    toolGroup: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center",
      paddingRight: 16,
      borderRight: "1px solid #e5e7eb",
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: 700,
      color: "#9ca3af",
      textTransform: "uppercase",
      letterSpacing: 1,
      width: "100%",
      marginBottom: 2,
    },
    groupHint: {
      fontSize: 11,
      color: "#64748b",
      width: "100%",
      lineHeight: 1.35,
      marginBottom: 8,
    },
    subLabel: {
      fontSize: 10,
      fontWeight: 700,
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      width: "100%",
      marginTop: 4,
      marginBottom: 2,
    },
    toolBtn: {
      padding: "6px 12px",
      borderRadius: 6,
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      fontSize: 13,
      fontWeight: 500,
      color: "#374151",
      cursor: "pointer",
    },
    toolBtnOn: {
      background: "#2563eb",
      color: "#fff",
      borderColor: "#2563eb",
    },
    textInput: { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, width: 160 },
    select: { padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#f9fafb" },
    colorRow: { display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" },
    colorDot: { width: 22, height: 22, borderRadius: "50%", cursor: "pointer", flexShrink: 0, padding: 0 },
    exportBtn: {
      marginLeft: "auto",
      padding: "10px 20px",
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 700,
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.toolbar}>
      {mode === "visual" ? (
        <>
          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Templates</span>
            <button type="button" style={styles.toolBtn} onClick={() => onTemplate("headline")}>Big headline</button>
            <button type="button" style={styles.toolBtn} onClick={() => onTemplate("lowerThird")}>Lower third</button>
            <button type="button" style={styles.toolBtn} onClick={() => onTemplate("split")}>Split panel</button>
            <button type="button" style={styles.toolBtn} onClick={() => onTemplate("hours")}>Hours / list</button>
          </div>

          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Add</span>
            <button type="button" style={styles.toolBtn} onClick={onAddText}>＋ Text</button>
            <button type="button" style={styles.toolBtn} onClick={onAddRect}>▭ Box</button>
            <button type="button" style={styles.toolBtn} onClick={onAddCircle}>◯ Circle</button>
            <label style={{ ...styles.toolBtn, cursor: "pointer" }}>
              Image
              <input type="file" accept="image/*" onChange={onAddImage} style={{ display: "none" }} />
            </label>
          </div>

          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Appearance</span>
            <span style={styles.groupHint}>Select an object on the canvas, then change fill, outline, or type settings below.</span>
            <input style={{ ...styles.textInput, minWidth: 140 }} value={text} onChange={onTextChange} placeholder="Text (selection or next insert)" />
            <select style={styles.select} value={fontFamily} onChange={onFontFamilyChange}>
              {FONTS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <input type="number" style={{ ...styles.select, width: 64 }} value={fontSize} min={12} max={320} onChange={onFontSizeChange} />
            <button type="button" style={{ ...styles.toolBtn, fontWeight: "bold", ...(bold ? styles.toolBtnOn : {}) }} onClick={onToggleBold}>B</button>
            <button type="button" style={{ ...styles.toolBtn, fontStyle: "italic", ...(italic ? styles.toolBtnOn : {}) }} onClick={onToggleItalic}>I</button>
            <span style={styles.subLabel}>Fill</span>
            <div style={styles.colorRow}>
              {COLORS.map((c) => (
                <button type="button" key={c} title={`Fill ${c}`} onClick={() => onApplyFill(c)}
                  style={{ ...styles.colorDot, background: c, border: textColor === c ? "3px solid #2563eb" : "2px solid #d1d5db" }}
                />
              ))}
              <input type="color" value={colorPickerHex(textColor)} onChange={(e) => onApplyFill(e.target.value)} title="Custom fill"
                style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
              />
            </div>
            <span style={styles.subLabel}>Outline</span>
            <div style={styles.colorRow}>
              {COLORS.map((c) => (
                <button type="button" key={`st-${c}`} title={`Outline ${c}`} onClick={() => onApplyStroke(c)}
                  style={{ ...styles.colorDot, background: c, border: strokeColor === c ? "3px solid #2563eb" : "2px solid #d1d5db" }}
                />
              ))}
              <input type="color" value={colorPickerHex(strokeColor, "#000000")} onChange={(e) => onApplyStroke(e.target.value)} title="Custom outline"
                style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
              />
            </div>
          </div>

          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Background</span>
            <div style={styles.colorRow}>
              {BG_SWATCH.map((c) => (
                <button type="button" key={c} title={c} onClick={() => onBgChange(c)}
                  style={{ ...styles.colorDot, background: c, border: bgColor === c ? "3px solid #2563eb" : "2px solid #d1d5db" }}
                />
              ))}
            </div>
            <input type="color" value={bgColor} onChange={(e) => onBgChange(e.target.value)} style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
          </div>

          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Arrange</span>
            <button type="button" style={styles.toolBtn} onClick={onBringForward} disabled={!selected}>↑ Forward</button>
            <button type="button" style={styles.toolBtn} onClick={onSendBackward} disabled={!selected}>↓ Back</button>
            <button type="button" style={{ ...styles.toolBtn, background: "#fee2e2", color: "#b91c1c" }} onClick={onDelete} disabled={!selected}>Delete</button>
            <button type="button" style={{ ...styles.toolBtn, background: "#fef9c3", color: "#92400e" }} onClick={onClear}>Clear all</button>
          </div>

          <label style={{ ...styles.toolGroup, borderRight: "none", alignItems: "center" }}>
            <span style={styles.groupLabel}>Export</span>
            <label style={{ display: "flex", gap: 6, fontSize: 13, color: "#374151", alignItems: "center" }}>
              <input type="checkbox" checked={exportJpeg} onChange={(e) => onExportJpegChange(e.target.checked)} />
              JPEG (smaller file)
            </label>
          </label>
        </>
      ) : (
        <>
          <div style={{ ...styles.toolGroup, borderRight: "none", flex: 1, minWidth: 200 }}>
            <span style={styles.groupLabel}>Markdown</span>
            <textarea style={{ ...styles.textInput, width: "100%", minHeight: 88, fontFamily: "ui-monospace, monospace" }} value={markdown} onChange={onMarkdownChange} />
          </div>
          <div style={styles.toolGroup}>
            <span style={styles.groupLabel}>Typography</span>
            <select style={styles.select} value={mdFontFamily} onChange={onMdFontFamilyChange}>
              {["Segoe UI", "Inter", ...FONTS].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <input type="number" style={{ ...styles.select, width: 64 }} value={mdFontSize} min={10} max={120} onChange={onMdFontSizeChange} />
          </div>
        </>
      )}
      <button type="button" style={styles.exportBtn} onClick={onExport}>Use this slide</button>
    </div>
  );
}
