import { useState, useRef, useEffect } from "react";
import * as fabricModule from "fabric";
import { toPng } from "html-to-image";
import FabricCanvas from "./FabricCanvas";
import MarkdownCanvas from "./MarkdownCanvas";
import "katex/dist/katex.min.css";

const fabric = fabricModule.fabric;
const CANVAS_W = 1280;
const CANVAS_H = 720;

const FONTS = ["Arial", "Georgia", "Courier New", "Verdana", "Trebuchet MS", "Impact"];
const COLORS = ["#ffffff", "#000000", "#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"];

export default function Designer({ onExport }) {
  const [mode, setMode] = useState("visual"); // visual | markdown
  
  const canvasEl = useRef();
  const fabricRef = useRef();
  const markdownRef = useRef();
  const [selected, setSelected] = useState(null);

  // Visual mode state
  const [text, setText] = useState("Your Text Here");
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFont] = useState("Arial");
  const [textColor, setTextColor] = useState("#ffffff");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [bgColor, setBgColor] = useState("#1d4ed8");

  // Markdown mode state
  const [markdown, setMarkdown] = useState("# New Announcement\n\nWrite your message here...");
  const [mdFontSize, setMdFontSize] = useState(32);
  const [mdFontFamily, setMdFontFamily] = useState("Inter");

  // ── Actions ─────────────────────────────────────────────────
  const addText = () => {
    if (!fabricRef.current) return;
    const t = new fabric.Textbox(text, {
      left: 100, top: 100, width: 600, fontSize, fontFamily,
      fill: textColor, fontWeight: bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal", editable: true,
    });
    fabricRef.current.add(t);
    fabricRef.current.setActiveObject(t);
  };

  const addRect = () => {
    fabricRef.current?.add(new fabric.Rect({
      left: 200, top: 200, width: 300, height: 120, fill: "#ffffff22",
      stroke: "#ffffff", strokeWidth: 2, rx: 8,
    }));
  };

  const addCircle = () => {
    fabricRef.current?.add(new fabric.Circle({
      left: 300, top: 250, radius: 80, fill: "#ffffff22",
      stroke: "#ffffff", strokeWidth: 2,
    }));
  };

  const addImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    fabric.Image.fromURL(url, (img) => {
      img.scaleToWidth(400);
      img.set({ left: 200, top: 150 });
      fabricRef.current?.add(img);
    });
  };

  const deleteSelected = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      fabricRef.current.remove(obj);
      setSelected(null);
    }
  };

  const bringForward = () => fabricRef.current?.getActiveObject()?.bringForward();
  const sendBackward = () => fabricRef.current?.getActiveObject()?.sendBackwards();
  
  const clearCanvas = () => {
    if (!confirm("Clear everything?")) return;
    fabricRef.current?.clear();
    fabricRef.current?.setBackgroundColor(bgColor, () => fabricRef.current.renderAll());
  };

  const exportImage = async () => {
    let dataUrl = "";
    try {
      if (mode === "visual") {
        if (!fabricRef.current) return;
        dataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 1 });
      } else {
        if (!markdownRef.current) return;
        dataUrl = await toPng(markdownRef.current, { 
          width: CANVAS_W, 
          height: CANVAS_H,
          style: { visibility: 'visible' }
        });
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `design-${Date.now()}.png`, { type: "image/png" });
      onExport(file, dataUrl);
    } catch (err) {
      console.error("Export Error:", err);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <button 
          style={{ ...styles.toolBtn, background: mode === 'visual' ? '#2563eb' : '#f9fafb', color: mode === 'visual' ? '#fff' : '#374151' }}
          onClick={() => setMode('visual')}
        >🎨 Visual Designer</button>
        <button 
          style={{ ...styles.toolBtn, background: mode === 'markdown' ? '#2563eb' : '#f9fafb', color: mode === 'markdown' ? '#fff' : '#374151' }}
          onClick={() => setMode('markdown')}
        >📝 Markdown Document</button>
      </div>

      <div style={styles.toolbar}>
        {mode === "visual" ? (
          <>
            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Add</span>
              <button style={styles.toolBtn} onClick={addText}>＋ Text</button>
              <button style={styles.toolBtn} onClick={addRect}>▭ Box</button>
              <button style={styles.toolBtn} onClick={addCircle}>◯ Circle</button>
              <label style={{ ...styles.toolBtn, cursor: "pointer" }}>
                🖼 Image
                <input type="file" accept="image/*" onChange={addImage} style={{ display: "none" }} />
              </label>
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Text</span>
              <input style={styles.textInput} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text content" />
              <select style={styles.select} value={fontFamily} onChange={(e) => setFont(e.target.value)}>
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" style={{ ...styles.select, width: 60 }} value={fontSize} min={10} max={200} onChange={(e) => setFontSize(Number(e.target.value))} />
              <button style={{ ...styles.toolBtn, fontWeight: "bold", background: bold ? "#2563eb" : "#e5e7eb", color: bold ? "#fff" : "#374151" }} onClick={() => setBold(!bold)}>B</button>
              <button style={{ ...styles.toolBtn, fontStyle: "italic", background: italic ? "#2563eb" : "#e5e7eb", color: italic ? "#fff" : "#374151" }} onClick={() => setItalic(!italic)}>I</button>
              <div style={styles.colorRow}>
                {COLORS.map((c) => (
                  <div key={c} onClick={() => setTextColor(c)} style={{ ...styles.colorDot, background: c, border: textColor === c ? "3px solid #2563eb" : "2px solid #d1d5db" }} />
                ))}
              </div>
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Background</span>
              <div style={styles.colorRow}>
                {[...COLORS, "#0f172a", "#1e3a5f", "#064e3b", "#7f1d1d"].map((c) => (
                  <div key={c} onClick={() => setBgColor(c)} style={{ ...styles.colorDot, background: c, border: bgColor === c ? "3px solid #2563eb" : "2px solid #d1d5db" }} />
                ))}
              </div>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer" }} />
            </div>

            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>Arrange</span>
              <button style={styles.toolBtn} onClick={bringForward} disabled={!selected}>↑ Forward</button>
              <button style={styles.toolBtn} onClick={sendBackward} disabled={!selected}>↓ Back</button>
              <button style={{ ...styles.toolBtn, background: "#fee2e2", color: "#b91c1c" }} onClick={deleteSelected} disabled={!selected}>🗑 Delete</button>
              <button style={{ ...styles.toolBtn, background: "#fef9c3", color: "#92400e" }} onClick={clearCanvas}>✕ Clear All</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ ...styles.toolGroup, borderRight: 'none', flex: 1 }}>
              <span style={styles.groupLabel}>Markdown Source</span>
              <textarea 
                style={{ ...styles.textInput, width: '100%', minHeight: 80, fontFamily: 'monospace' }} 
                value={markdown} 
                onChange={(e) => setMarkdown(e.target.value)}
              />
            </div>
            <div style={styles.toolGroup}>
              <span style={styles.groupLabel}>MD Style</span>
              <select 
                style={styles.select} 
                value={mdFontFamily} 
                onChange={(e) => setMdFontFamily(e.target.value)}
              >
                {["Inter", ...FONTS].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input 
                type="number" 
                style={{ ...styles.select, width: 60 }} 
                value={mdFontSize} 
                min={10} 
                max={100} 
                onChange={(e) => setMdFontSize(Number(e.target.value))} 
              />
            </div>
          </>
        )}

        <button style={styles.exportBtn} onClick={exportImage}>✅ Use This Design</button>
      </div>

      <div style={styles.canvasWrapper}>
        <div style={styles.canvasScaler}>
          <div style={{ display: mode === 'visual' ? 'block' : 'none' }}>
            <FabricCanvas 
              fabricRef={fabricRef} 
              canvasEl={canvasEl} 
              bgColor={bgColor} 
              setSelected={setSelected}
            />
          </div>
          <div style={{ display: mode === 'markdown' ? 'block' : 'none' }}>
            <MarkdownCanvas 
              markdown={markdown} 
              markdownRef={markdownRef} 
              fontSize={mdFontSize}
              fontFamily={mdFontFamily}
            />
          </div>
        </div>
        <div style={styles.canvasMeta}>1280 × 720 px · 16:9</div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
  toolbar: {
    display: "flex", flexWrap: "wrap", gap: 12, background: "#fff",
    borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", alignItems: "flex-end",
  },
  toolGroup: {
    display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
    paddingRight: 16, borderRight: "1px solid #e5e7eb",
  },
  groupLabel: { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, width: "100%", marginBottom: 4 },
  toolBtn: { padding: "6px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" },
  textInput: { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, width: 160 },
  select: { padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, background: "#f9fafb" },
  colorRow: { display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" },
  colorDot: { width: 22, height: 22, borderRadius: "50%", cursor: "pointer", flexShrink: 0 },
  exportBtn: { marginLeft: "auto", padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  canvasWrapper: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  canvasScaler: { width: "100%", maxWidth: "100%", overflow: "auto", background: "#1a1a2e", borderRadius: 10, padding: 16 },
  canvasMeta: { fontSize: 12, color: "#9ca3af" },
};
