import { useState, useRef, useMemo, useCallback } from "react";
import * as fabricModule from "fabric";
import { toPng } from "html-to-image";
import FabricCanvas from "./FabricCanvas";
import MarkdownCanvas from "./MarkdownCanvas";
import "katex/dist/katex.min.css";
import usePersistentState from "../hooks/usePersistentState";

const fabric = fabricModule.fabric;

/** 16:9 canvases tuned for wall TVs; export matches preview pixel size. */
const TV_PRESETS = [
  { id: "hd", label: "HD 1280 × 720", w: 1280, h: 720 },
  { id: "fhd", label: "TV Full HD 1920 × 1080", w: 1920, h: 1080 },
];

const FONTS = [
  "Impact",
  "Arial Black",
  "Arial",
  "Georgia",
  "Segoe UI",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
];
const COLORS = [
  "#ffffff",
  "#000000",
  "#1d4ed8",
  "#dc2626",
  "#16a34a",
  "#f59e0b",
  "#7c3aed",
  "#0891b2",
];

const BG_SWATCH = [...COLORS, "#0f172a", "#1e3a5f", "#064e3b", "#7f1d1d"];

const MAX_PREVIEW_CSS_W = 920;

function isTextLike(o) {
  return o && (o.type === "textbox" || o.type === "i-text" || o.type === "text");
}

function getSelectionTargets(canvas) {
  if (!canvas) return [];
  const o = canvas.getActiveObject();
  if (!o) return [];
  if (o.type === "activeSelection" && typeof o.getObjects === "function") {
    return o.getObjects();
  }
  return [o];
}

function canSetFill(o) {
  if (!o || o.type === "image" || o.type === "group") return false;
  return typeof o.set === "function";
}

function canSetStroke(o) {
  if (!o || o.type === "image" || o.type === "group") return false;
  return typeof o.set === "function" && "stroke" in o;
}

/** HTML color inputs need #rrggbb (no alpha). */
function colorPickerHex(c, fallback = "#ffffff") {
  if (typeof c !== "string" || !c.startsWith("#")) return fallback;
  const m = c.match(/^#([0-9a-fA-F]{6})/);
  return m ? `#${m[1]}` : fallback;
}

function SafeZoneOverlay({ width, height, marginRatio = 0.06 }) {
  const m = Math.round(Math.min(width, height) * marginRatio);
  const shade = "rgba(250, 204, 21, 0.38)";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        title="Keep important text inside the clear center (typical TV overscan)"
        style={{ position: "absolute", left: 0, top: 0, right: 0, height: m, background: shade }}
      />
      <div
        style={{ position: "absolute", left: 0, bottom: 0, right: 0, height: m, background: shade }}
      />
      <div
        style={{ position: "absolute", left: 0, top: m, bottom: m, width: m, background: shade }}
      />
      <div
        style={{ position: "absolute", right: 0, top: m, bottom: m, width: m, background: shade }}
      />
      <div
        style={{
          position: "absolute",
          left: m,
          top: m,
          right: m,
          bottom: m,
          border: "2px dashed rgba(255,255,255,0.65)",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function applyTemplate(canvas, preset, templateId, bgHex) {
  const w = preset.w;
  const h = preset.h;
  canvas.clear();

  let bg = bgHex;
  if (templateId === "split") bg = "#f8fafc";
  if (templateId === "hours") bg = "#e2e8f0";
  canvas.backgroundColor = bg;

  if (templateId === "headline") {
    const tb = new fabric.Textbox("YOUR MESSAGE HERE", {
      left: w * 0.07,
      top: h * 0.32,
      width: w * 0.86,
      fontSize: Math.round(h * 0.095),
      fontFamily: "Impact",
      fill: "#ffffff",
      textAlign: "center",
      shadow: "4px 6px 14px rgba(0,0,0,0.45)",
    });
    canvas.add(tb);
    canvas.setActiveObject(tb);
  } else if (templateId === "lowerThird") {
    const band = new fabric.Rect({
      left: 0,
      top: h * 0.71,
      width: w,
      height: h * 0.29,
      fill: "rgba(0,0,0,0.86)",
    });
    const title = new fabric.Textbox("HEADLINE", {
      left: w * 0.05,
      top: h * 0.735,
      width: w * 0.9,
      fontSize: Math.round(h * 0.052),
      fontFamily: "Impact",
      fill: "#ffffff",
    });
    const sub = new fabric.Textbox("Time · place · short detail", {
      left: w * 0.05,
      top: h * 0.84,
      width: w * 0.9,
      fontSize: Math.round(h * 0.026),
      fontFamily: "Arial",
      fill: "#e5e7eb",
    });
    canvas.add(band, title, sub);
    canvas.setActiveObject(title);
  } else if (templateId === "split") {
    const panel = new fabric.Rect({
      left: 0,
      top: 0,
      width: w * 0.38,
      height: h,
      fill: "#0f172a",
    });
    const headline = new fabric.Textbox("SIDE\nTITLE", {
      left: w * 0.05,
      top: h * 0.18,
      width: w * 0.28,
      fontSize: Math.round(h * 0.072),
      fontFamily: "Impact",
      fill: "#ffffff",
      lineHeight: 0.95,
    });
    const body = new fabric.Textbox(
      "Main announcement text goes here. Use short lines for distance viewing.",
      {
        left: w * 0.44,
        top: h * 0.14,
        width: w * 0.5,
        fontSize: Math.round(h * 0.038),
        fontFamily: "Segoe UI",
        fill: "#111827",
      },
    );
    canvas.add(panel, headline, body);
    canvas.setActiveObject(body);
  } else if (templateId === "hours") {
    const box = new fabric.Rect({
      left: w * 0.08,
      top: h * 0.1,
      width: w * 0.84,
      height: h * 0.8,
      fill: "#ffffff",
      stroke: "#e5e7eb",
      strokeWidth: 3,
      rx: 12,
    });
    const t = new fabric.Textbox("HOURS & INFO", {
      left: w * 0.12,
      top: h * 0.16,
      width: w * 0.76,
      fontSize: Math.round(h * 0.065),
      fontFamily: "Impact",
      fill: "#0f172a",
      textAlign: "center",
    });
    const lines = new fabric.Textbox("Mon–Fri  9:00 – 17:00\nSat  10:00 – 14:00\nClosed Sundays", {
      left: w * 0.14,
      top: h * 0.34,
      width: w * 0.72,
      fontSize: Math.round(h * 0.04),
      fontFamily: "Georgia",
      fill: "#1f2937",
      lineHeight: 1.35,
    });
    canvas.add(box, t, lines);
    canvas.setActiveObject(lines);
  }
  canvas.requestRenderAll();
}

export default function Designer({ onExport }) {
  const [mode, setMode] = usePersistentState("designer.mode", "visual");
  const [presetId, setPresetId] = usePersistentState("designer.presetId", "fhd");
  const preset = useMemo(
    () => TV_PRESETS.find((p) => p.id === presetId) || TV_PRESETS[0],
    [presetId],
  );

  const previewScale = Math.min(1, MAX_PREVIEW_CSS_W / preset.w);

  const canvasEl = useRef();
  const fabricRef = useRef();
  const markdownRef = useRef();
  const [selected, setSelected] = useState(null);

  const [showSafeZone, setShowSafeZone] = usePersistentState("designer.showSafeZone", true);
  const [exportJpeg, setExportJpeg] = usePersistentState("designer.exportJpeg", false);

  const [text, setText] = usePersistentState("designer.text", "Your headline");
  const [fontSize, setFontSize] = usePersistentState("designer.fontSize", 64);
  const [fontFamily, setFont] = usePersistentState("designer.fontFamily", "Impact");
  const [textColor, setTextColor] = usePersistentState("designer.textColor", "#ffffff");
  const [bold, setBold] = usePersistentState("designer.bold", false);
  const [italic, setItalic] = usePersistentState("designer.italic", false);
  const [bgColor, setBgColor] = usePersistentState("designer.bgColor", "#0f172a");
  const [strokeColor, setStrokeColor] = usePersistentState("designer.strokeColor", "#ffffff");
  const [canvasJson, setCanvasJson] = usePersistentState("designer.canvasJson", null);

  const [markdown, setMarkdown] = usePersistentState(
    "designer.markdown",
    "# On-screen announcement\n\nShort sentences read best from across the room.",
  );
  const [mdFontSize, setMdFontSize] = usePersistentState("designer.mdFontSize", 36);
  const [mdFontFamily, setMdFontFamily] = usePersistentState("designer.mdFontFamily", "Segoe UI");

  const syncToolbarFromObject = useCallback((o) => {
    if (!o) return;
    if (o.type === "activeSelection") {
      const parts = o.getObjects?.() || [];
      const texts = parts.filter(isTextLike);
      if (texts.length === 1) {
        const t = texts[0];
        setText(t.text ?? "");
        if (typeof t.fill === "string") setTextColor(t.fill);
        setFont(t.fontFamily || "Arial");
        setFontSize(Math.round(t.fontSize || 24));
        setBold(t.fontWeight === "bold" || t.fontWeight === 700);
        setItalic(t.fontStyle === "italic");
        if (typeof t.stroke === "string") setStrokeColor(t.stroke);
      } else {
        const firstFill = parts.find((p) => canSetFill(p) && typeof p.fill === "string");
        if (firstFill) setTextColor(firstFill.fill);
        const firstStroke = parts.find((p) => canSetStroke(p) && typeof p.stroke === "string");
        if (firstStroke) setStrokeColor(firstStroke.stroke);
      }
      return;
    }
    if (isTextLike(o)) {
      setText(o.text ?? "");
      if (typeof o.fill === "string") setTextColor(o.fill);
      setFont(o.fontFamily || "Arial");
      setFontSize(Math.round(o.fontSize || 24));
      setBold(o.fontWeight === "bold" || o.fontWeight === 700);
      setItalic(o.fontStyle === "italic");
      if (typeof o.stroke === "string") setStrokeColor(o.stroke);
      return;
    }
    if (typeof o.fill === "string") setTextColor(o.fill);
    if (typeof o.stroke === "string") setStrokeColor(o.stroke);
  }, [setBold, setFont, setFontSize, setItalic, setStrokeColor, setText, setTextColor]);

  const setCanvasSelection = useCallback(
    (o) => {
      setSelected(o);
      syncToolbarFromObject(o);
    },
    [syncToolbarFromObject],
  );

  const handleCanvasStyleSync = useCallback(() => {
    const o = fabricRef.current?.getActiveObject();
    if (o) syncToolbarFromObject(o);
  }, [syncToolbarFromObject]);

  const applyFillColor = (c) => {
    const canvas = fabricRef.current;
    const targets = getSelectionTargets(canvas);
    if (targets.length && canvas) {
      let hit = false;
      targets.forEach((obj) => {
        if (!canSetFill(obj)) return;
        obj.set("fill", c);
        hit = true;
      });
      if (hit) canvas.requestRenderAll();
    }
    setTextColor(c);
  };

  const applyStrokeColor = (c) => {
    const canvas = fabricRef.current;
    const targets = getSelectionTargets(canvas);
    if (targets.length && canvas) {
      let hit = false;
      targets.forEach((obj) => {
        if (!canSetStroke(obj)) return;
        const sw = obj.strokeWidth > 0 ? obj.strokeWidth : 2;
        obj.set({ stroke: c, strokeWidth: sw });
        hit = true;
      });
      if (hit) canvas.requestRenderAll();
    }
    setStrokeColor(c);
  };

  const onTextBodyChange = (e) => {
    const v = e.target.value;
    const canvas = fabricRef.current;
    const texts = getSelectionTargets(canvas).filter(isTextLike);
    if (texts.length === 1 && canvas) {
      texts[0].set("text", v);
      canvas.requestRenderAll();
    }
    setText(v);
  };

  const onFontSizeChange = (e) => {
    const n = Number(e.target.value);
    const canvas = fabricRef.current;
    const texts = getSelectionTargets(canvas).filter(isTextLike);
    if (texts.length && canvas) {
      texts.forEach((t) => t.set("fontSize", n));
      canvas.requestRenderAll();
    }
    setFontSize(n);
  };

  const onFontFamilyChange = (e) => {
    const f = e.target.value;
    const canvas = fabricRef.current;
    const texts = getSelectionTargets(canvas).filter(isTextLike);
    if (texts.length && canvas) {
      texts.forEach((t) => t.set("fontFamily", f));
      canvas.requestRenderAll();
    }
    setFont(f);
  };

  const toggleBold = () => {
    const canvas = fabricRef.current;
    const texts = getSelectionTargets(canvas).filter(isTextLike);
    if (texts.length && canvas) {
      const allBold = texts.every((t) => t.fontWeight === "bold" || t.fontWeight === 700);
      const next = !allBold;
      texts.forEach((t) => t.set("fontWeight", next ? "bold" : "normal"));
      canvas.requestRenderAll();
      setBold(next);
    } else {
      setBold((b) => !b);
    }
  };

  const toggleItalic = () => {
    const canvas = fabricRef.current;
    const texts = getSelectionTargets(canvas).filter(isTextLike);
    if (texts.length && canvas) {
      const allIt = texts.every((t) => t.fontStyle === "italic");
      const next = !allIt;
      texts.forEach((t) => t.set("fontStyle", next ? "italic" : "normal"));
      canvas.requestRenderAll();
      setItalic(next);
    } else {
      setItalic((i) => !i);
    }
  };

  const changePreset = (id) => {
    if (id === presetId) return;
    const count = fabricRef.current?.getObjects?.()?.length ?? 0;
    if (
      count > 0 &&
      !window.confirm(
        "Changing the canvas size clears the current artwork. Continue?",
      )
    ) {
      return;
    }
    setCanvasJson(null);
    setPresetId(id);
  };

  const addText = () => {
    if (!fabricRef.current) return;
    const m = Math.round(Math.min(preset.w, preset.h) * 0.06);
    const t = new fabric.Textbox(text, {
      left: m + 40,
      top: m + 40,
      width: Math.min(900, preset.w - 2 * m - 80),
      fontSize,
      fontFamily,
      fill: textColor,
      fontWeight: bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal",
      editable: true,
    });
    fabricRef.current.add(t);
    fabricRef.current.setActiveObject(t);
    fabricRef.current.requestRenderAll();
  };

  const addRect = () => {
    fabricRef.current?.add(
      new fabric.Rect({
        left: preset.w * 0.22,
        top: preset.h * 0.28,
        width: preset.w * 0.28,
        height: preset.h * 0.2,
        fill: "#ffffff22",
        stroke: "#ffffff",
        strokeWidth: 2,
        rx: 8,
      }),
    );
    fabricRef.current?.requestRenderAll();
  };

  const addCircle = () => {
    fabricRef.current?.add(
      new fabric.Circle({
        left: preset.w * 0.35,
        top: preset.h * 0.32,
        radius: Math.min(preset.w, preset.h) * 0.07,
        fill: "#ffffff22",
        stroke: "#ffffff",
        strokeWidth: 2,
      }),
    );
    fabricRef.current?.requestRenderAll();
  };

  const addImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    fabric.Image.fromURL(url, (img) => {
      img.scaleToWidth(Math.min(560, preset.w * 0.45));
      img.set({ left: preset.w * 0.18, top: preset.h * 0.2 });
      fabricRef.current?.add(img);
      fabricRef.current?.requestRenderAll();
    });
    e.target.value = "";
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const actives = canvas.getActiveObjects();
    if (!actives.length) return;
    actives.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setCanvasSelection(null);
  };

  const bringForward = () => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o && typeof o.bringForward === "function") {
      o.bringForward();
      canvas.requestRenderAll();
    }
  };

  const sendBackward = () => {
    const canvas = fabricRef.current;
    const o = canvas?.getActiveObject();
    if (o && typeof o.sendBackwards === "function") {
      o.sendBackwards();
      canvas.requestRenderAll();
    }
  };

  const clearCanvas = () => {
    if (!confirm("Clear everything on the canvas?")) return;
    const c = fabricRef.current;
    if (!c) return;
    c.clear();
    c.setBackgroundColor(bgColor, () => c.renderAll());
    setCanvasJson(c.toJSON());
  };

  const runTemplate = (templateId) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const count = canvas.getObjects().length;
    if (
      count > 0 &&
      !window.confirm("Replace the current design with this template?")
    ) {
      return;
    }
    applyTemplate(canvas, preset, templateId, bgColor);
  };

  const exportImage = async () => {
    let dataUrl;
    try {
      if (mode === "visual") {
        if (!fabricRef.current) return;
        dataUrl = fabricRef.current.toDataURL({
          format: exportJpeg ? "jpeg" : "png",
          quality: exportJpeg ? 0.9 : 1,
          multiplier: 1,
        });
      } else {
        if (!markdownRef.current) return;
        dataUrl = await toPng(markdownRef.current, {
          width: preset.w,
          height: preset.h,
          style: { visibility: "visible" },
        });
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = exportJpeg && mode === "visual" ? "jpg" : "png";
      const file = new File([blob], `signage-${Date.now()}.${ext}`, {
        type: exportJpeg && mode === "visual" ? "image/jpeg" : "image/png",
      });
      onExport(file, dataUrl);
    } catch (err) {
      console.error("Export Error:", err);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.topBar}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={styles.kicker}>Digital signage</span>
          <div style={styles.segment}>
            {TV_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                style={{
                  ...styles.segBtn,
                  ...(presetId === p.id ? styles.segBtnOn : {}),
                }}
                onClick={() => changePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={showSafeZone}
            onChange={(e) => setShowSafeZone(e.target.checked)}
          />
          TV safe area
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            ...styles.toolBtn,
            ...(mode === "visual" ? styles.toolBtnOn : {}),
          }}
          onClick={() => setMode("visual")}
        >
          Visual canvas
        </button>
        <button
          type="button"
          style={{
            ...styles.toolBtn,
            ...(mode === "markdown" ? styles.toolBtnOn : {}),
          }}
          onClick={() => setMode("markdown")}
        >
          Markdown slide
        </button>
      </div>

      <div style={styles.toolbar}>
        {mode === "visual" ? (
          <>
            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Templates</span>
              <button type="button" style={styles.toolBtn} onClick={() => runTemplate("headline")}>
                Big headline
              </button>
              <button type="button" style={styles.toolBtn} onClick={() => runTemplate("lowerThird")}>
                Lower third
              </button>
              <button type="button" style={styles.toolBtn} onClick={() => runTemplate("split")}>
                Split panel
              </button>
              <button type="button" style={styles.toolBtn} onClick={() => runTemplate("hours")}>
                Hours / list
              </button>
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Add</span>
              <button type="button" style={styles.toolBtn} onClick={addText}>
                ＋ Text
              </button>
              <button type="button" style={styles.toolBtn} onClick={addRect}>
                ▭ Box
              </button>
              <button type="button" style={styles.toolBtn} onClick={addCircle}>
                ◯ Circle
              </button>
              <label style={{ ...styles.toolBtn, cursor: "pointer" }}>
                Image
                <input type="file" accept="image/*" onChange={addImage} style={{ display: "none" }} />
              </label>
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Appearance</span>
              <span style={styles.groupHint}>
                Select an object on the canvas, then change fill, outline, or type settings below.
              </span>
              <input
                style={{ ...styles.textInput, minWidth: 140 }}
                value={text}
                onChange={onTextBodyChange}
                placeholder="Text (selection or next insert)"
              />
              <select style={styles.select} value={fontFamily} onChange={onFontFamilyChange}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                style={{ ...styles.select, width: 64 }}
                value={fontSize}
                min={12}
                max={320}
                onChange={onFontSizeChange}
              />
              <button
                type="button"
                style={{
                  ...styles.toolBtn,
                  fontWeight: "bold",
                  ...(bold ? styles.toolBtnOn : {}),
                }}
                onClick={toggleBold}
              >
                B
              </button>
              <button
                type="button"
                style={{
                  ...styles.toolBtn,
                  fontStyle: "italic",
                  ...(italic ? styles.toolBtnOn : {}),
                }}
                onClick={toggleItalic}
              >
                I
              </button>
              <span style={styles.subLabel}>Fill</span>
              <div style={styles.colorRow}>
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    title={`Fill ${c}`}
                    onClick={() => applyFillColor(c)}
                    style={{
                      ...styles.colorDot,
                      background: c,
                      border:
                        textColor === c ? "3px solid #2563eb" : "2px solid #d1d5db",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={colorPickerHex(textColor)}
                  onChange={(e) => applyFillColor(e.target.value)}
                  title="Custom fill"
                  style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
                />
              </div>
              <span style={styles.subLabel}>Outline</span>
              <div style={styles.colorRow}>
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={`st-${c}`}
                    title={`Outline ${c}`}
                    onClick={() => applyStrokeColor(c)}
                    style={{
                      ...styles.colorDot,
                      background: c,
                      border:
                        strokeColor === c ? "3px solid #2563eb" : "2px solid #d1d5db",
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={colorPickerHex(strokeColor, "#000000")}
                  onChange={(e) => applyStrokeColor(e.target.value)}
                  title="Custom outline"
                  style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
                />
              </div>
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Background</span>
              <div style={styles.colorRow}>
                {BG_SWATCH.map((c) => (
                  <button
                    type="button"
                    key={c}
                    title={c}
                    onClick={() => setBgColor(c)}
                    style={{
                      ...styles.colorDot,
                      background: c,
                      border: bgColor === c ? "3px solid #2563eb" : "2px solid #d1d5db",
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }}
              />
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Arrange</span>
              <button type="button" style={styles.toolBtn} onClick={bringForward} disabled={!selected}>
                ↑ Forward
              </button>
              <button type="button" style={styles.toolBtn} onClick={sendBackward} disabled={!selected}>
                ↓ Back
              </button>
              <button
                type="button"
                style={{ ...styles.toolBtn, background: "#fee2e2", color: "#b91c1c" }}
                onClick={deleteSelected}
                disabled={!selected}
              >
                Delete
              </button>
              <button type="button" style={{ ...styles.toolBtn, background: "#fef9c3", color: "#92400e" }} onClick={clearCanvas}>
                Clear all
              </button>
            </div>

            <label style={{ ...styles.toolGroup, borderRight: "none", alignItems: "center" }}>
              <span style={styles.groupLabel}>Export</span>
              <label style={{ display: "flex", gap: 6, fontSize: 13, color: "#374151", alignItems: "center" }}>
                <input type="checkbox" checked={exportJpeg} onChange={(e) => setExportJpeg(e.target.checked)} />
                JPEG (smaller file)
              </label>
            </label>
          </>
        ) : (
          <>
            <div style={{ ...styles.toolGroup, borderRight: "none", flex: 1, minWidth: 200 }}>
              <span style={styles.groupLabel}>Markdown</span>
              <textarea
                style={{ ...styles.textInput, width: "100%", minHeight: 88, fontFamily: "ui-monospace, monospace" }}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
              />
            </div>
            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Typography</span>
              <select style={styles.select} value={mdFontFamily} onChange={(e) => setMdFontFamily(e.target.value)}>
                {["Segoe UI", "Inter", ...FONTS].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                style={{ ...styles.select, width: 64 }}
                value={mdFontSize}
                min={10}
                max={120}
                onChange={(e) => setMdFontSize(Number(e.target.value))}
              />
            </div>
          </>
        )}

        <button type="button" style={styles.exportBtn} onClick={exportImage}>
          Use this slide
        </button>
      </div>

      <div style={styles.canvasWrapper}>
        <p style={styles.hint}>
          {preset.w} × {preset.h}px · 16∶9 — preview scaled to fit; exported image matches this size for crisp playback on
          TVs.
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
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: 10 },
  topBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  segment: { display: "flex", flexWrap: "wrap", gap: 6 },
  segBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    cursor: "pointer",
  },
  segBtnOn: {
    background: "#0f172a",
    color: "#fff",
    borderColor: "#0f172a",
  },
  toggle: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#475569", cursor: "pointer" },
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
  canvasWrapper: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 },
  hint: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.45,
  },
  canvasScaler: {
    width: "100%",
    overflow: "auto",
    background: "#0f172a",
    borderRadius: 10,
    padding: 16,
  },
};
