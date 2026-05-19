import { useState, useRef, useMemo, useCallback } from "react";
import * as fabricModule from "fabric";
import { toPng } from "html-to-image";
import "katex/dist/katex.min.css";
import usePersistentState, { userScopedKey } from "../hooks/usePersistentState";
import useAuthStore from "../store/useAuthStore";
import DesignerToolbar from "./designer/DesignerToolbar";
import DesignerCanvas from "./designer/DesignerCanvas";
import applyTemplate from "./designer/applyTemplate";
import {
  TV_PRESETS,
  isTextLike,
  getSelectionTargets,
  canSetFill,
  canSetStroke,
} from "./designer/designerConstants";

const fabric = fabricModule.fabric;

export default function Designer({ onExport }) {
  const userId = useAuthStore((s) => s.id);

  const [mode, setMode] = usePersistentState(userScopedKey("designer.mode", userId), "visual");
  const [presetId, setPresetId] = usePersistentState(userScopedKey("designer.presetId", userId), "fhd");
  const preset = useMemo(
    () => TV_PRESETS.find((p) => p.id === presetId) || TV_PRESETS[0],
    [presetId],
  );

  const canvasEl = useRef();
  const fabricRef = useRef();
  const markdownRef = useRef();
  const [selected, setSelected] = useState(null);

  const [showSafeZone, setShowSafeZone] = usePersistentState(userScopedKey("designer.showSafeZone", userId), true);
  const [exportJpeg, setExportJpeg] = usePersistentState(userScopedKey("designer.exportJpeg", userId), false);

  const [text, setText] = usePersistentState(userScopedKey("designer.text", userId), "Your headline");
  const [fontSize, setFontSize] = usePersistentState(userScopedKey("designer.fontSize", userId), 64);
  const [fontFamily, setFont] = usePersistentState(userScopedKey("designer.fontFamily", userId), "Impact");
  const [textColor, setTextColor] = usePersistentState(userScopedKey("designer.textColor", userId), "#ffffff");
  const [bold, setBold] = usePersistentState(userScopedKey("designer.bold", userId), false);
  const [italic, setItalic] = usePersistentState(userScopedKey("designer.italic", userId), false);
  const [bgColor, setBgColor] = usePersistentState(userScopedKey("designer.bgColor", userId), "#0f172a");
  const [strokeColor, setStrokeColor] = usePersistentState(userScopedKey("designer.strokeColor", userId), "#ffffff");
  const [canvasJson, setCanvasJson] = usePersistentState(userScopedKey("designer.canvasJson", userId), null);

  const [markdown, setMarkdown] = usePersistentState(
    userScopedKey("designer.markdown", userId),
    "# On-screen announcement\n\nShort sentences read best from across the room.",
  );
  const [mdFontSize, setMdFontSize] = usePersistentState(userScopedKey("designer.mdFontSize", userId), 36);
  const [mdFontFamily, setMdFontFamily] = usePersistentState(userScopedKey("designer.mdFontFamily", userId), "Segoe UI");

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
    if (count > 0 && !window.confirm("Changing the canvas size clears the current artwork. Continue?")) {
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
    if (count > 0 && !window.confirm("Replace the current design with this template?")) {
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
                style={{ ...styles.segBtn, ...(presetId === p.id ? styles.segBtnOn : {}) }}
                onClick={() => changePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label style={styles.toggle}>
          <input type="checkbox" checked={showSafeZone} onChange={(e) => setShowSafeZone(e.target.checked)} />
          TV safe area
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <button type="button" style={{ ...styles.toolBtn, ...(mode === "visual" ? styles.toolBtnOn : {}) }} onClick={() => setMode("visual")}>
          Visual canvas
        </button>
        <button type="button" style={{ ...styles.toolBtn, ...(mode === "markdown" ? styles.toolBtnOn : {}) }} onClick={() => setMode("markdown")}>
          Markdown slide
        </button>
      </div>

      <DesignerToolbar
        mode={mode}
        selected={selected}
        text={text}
        fontSize={fontSize}
        fontFamily={fontFamily}
        textColor={textColor}
        bold={bold}
        italic={italic}
        bgColor={bgColor}
        strokeColor={strokeColor}
        exportJpeg={exportJpeg}
        markdown={markdown}
        mdFontSize={mdFontSize}
        mdFontFamily={mdFontFamily}
        onModeChange={setMode}
        onTextChange={onTextBodyChange}
        onFontSizeChange={onFontSizeChange}
        onFontFamilyChange={onFontFamilyChange}
        onToggleBold={toggleBold}
        onToggleItalic={toggleItalic}
        onApplyFill={applyFillColor}
        onApplyStroke={applyStrokeColor}
        onBgChange={setBgColor}
        onExportJpegChange={setExportJpeg}
        onTemplate={runTemplate}
        onAddText={addText}
        onAddRect={addRect}
        onAddCircle={addCircle}
        onAddImage={addImage}
        onDelete={deleteSelected}
        onBringForward={bringForward}
        onSendBackward={sendBackward}
        onClear={clearCanvas}
        onExport={exportImage}
        onMarkdownChange={(e) => setMarkdown(e.target.value)}
        onMdFontSizeChange={(e) => setMdFontSize(Number(e.target.value))}
        onMdFontFamilyChange={(e) => setMdFontFamily(e.target.value)}
      />

      <DesignerCanvas
        mode={mode}
        preset={preset}
        fabricRef={fabricRef}
        canvasEl={canvasEl}
        markdownRef={markdownRef}
        bgColor={bgColor}
        showSafeZone={showSafeZone}
        canvasJson={canvasJson}
        setCanvasJson={setCanvasJson}
        setCanvasSelection={setCanvasSelection}
        handleCanvasStyleSync={handleCanvasStyleSync}
        markdown={markdown}
        mdFontSize={mdFontSize}
        mdFontFamily={mdFontFamily}
        userId={userId}
      />
    </div>
  );
}

