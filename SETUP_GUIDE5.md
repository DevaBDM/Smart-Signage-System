The Fabric.js designer is the visual editor inside the **Content Manager** where users design announcement images before publishing them to displays.

---

## STEP 1 — Install Fabric.js

```bash
cd WebServer/frontend
npm install fabric
```

---

## STEP 2 — Create the Designer Component

```bash
touch src/components/FabricDesigner.jsx
```

```jsx
// src/components/FabricDesigner.jsx
import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";

const CANVAS_W = 1280;
const CANVAS_H = 720;

const FONTS = [
  "Arial",
  "Georgia",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
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

export default function FabricDesigner({ onExport }) {
  const canvasEl = useRef();
  const fabricRef = useRef();
  const [selected, setSelected] = useState(null);

  // Text controls
  const [text, setText] = useState("Your Text Here");
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFont] = useState("Arial");
  const [textColor, setTextColor] = useState("#ffffff");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);

  // Background
  const [bgColor, setBgColor] = useState("#1d4ed8");

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasEl.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: bgColor,
      selection: true,
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e) => setSelected(e.selected[0]));
    canvas.on("selection:updated", (e) => setSelected(e.selected[0]));
    canvas.on("selection:cleared", () => setSelected(null));

    return () => canvas.dispose();
  }, []);

  // Sync background color
  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.setBackgroundColor(bgColor, () =>
      fabricRef.current.renderAll(),
    );
  }, [bgColor]);

  // ── Object actions ──────────────────────────────────────────

  const addText = () => {
    const t = new fabric.Textbox(text, {
      left: 100,
      top: 100,
      width: 600,
      fontSize,
      fontFamily,
      fill: textColor,
      fontWeight: bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal",
      editable: true,
    });
    fabricRef.current.add(t);
    fabricRef.current.setActiveObject(t);
  };

  const addRect = () => {
    fabricRef.current.add(
      new fabric.Rect({
        left: 200,
        top: 200,
        width: 300,
        height: 120,
        fill: "#ffffff22",
        stroke: "#ffffff",
        strokeWidth: 2,
        rx: 8,
      }),
    );
  };

  const addCircle = () => {
    fabricRef.current.add(
      new fabric.Circle({
        left: 300,
        top: 250,
        radius: 80,
        fill: "#ffffff22",
        stroke: "#ffffff",
        strokeWidth: 2,
      }),
    );
  };

  const addImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    fabric.Image.fromURL(url, (img) => {
      img.scaleToWidth(400);
      img.set({ left: 200, top: 150 });
      fabricRef.current.add(img);
    });
  };

  const deleteSelected = () => {
    const obj = fabricRef.current.getActiveObject();
    if (obj) {
      fabricRef.current.remove(obj);
      setSelected(null);
    }
  };

  const bringForward = () =>
    fabricRef.current.getActiveObject()?.bringForward();
  const sendBackward = () =>
    fabricRef.current.getActiveObject()?.sendBackwards();
  const clearCanvas = () => {
    if (!confirm("Clear everything?")) return;
    fabricRef.current.clear();
    fabricRef.current.setBackgroundColor(bgColor, () =>
      fabricRef.current.renderAll(),
    );
  };

  const exportImage = () => {
    const dataUrl = fabricRef.current.toDataURL({
      format: "png",
      multiplier: 1,
    });
    // Convert dataURL → File for the parent (ContentManager) to upload
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `signage-${Date.now()}.png`, {
          type: "image/png",
        });
        onExport(file, dataUrl);
      });
  };

  return (
    <div style={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div style={styles.toolbar}>
        {/* Add Objects */}
        <div style={styles.toolGroup}>
          <span style={styles.groupLabel}>Add</span>
          <button style={styles.toolBtn} onClick={addText}>
            ＋ Text
          </button>
          <button style={styles.toolBtn} onClick={addRect}>
            ▭ Box
          </button>
          <button style={styles.toolBtn} onClick={addCircle}>
            ◯ Circle
          </button>
          <label style={{ ...styles.toolBtn, cursor: "pointer" }}>
            🖼 Image
            <input
              type="file"
              accept="image/*"
              onChange={addImage}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {/* Text Controls */}
        <div style={styles.toolGroup}>
          <span style={styles.groupLabel}>Text</span>
          <input
            style={styles.textInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Text content"
          />
          <select
            style={styles.select}
            value={fontFamily}
            onChange={(e) => setFont(e.target.value)}
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <input
            type="number"
            style={{ ...styles.select, width: 60 }}
            value={fontSize}
            min={10}
            max={200}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
          <button
            style={{
              ...styles.toolBtn,
              fontWeight: "bold",
              background: bold ? "#2563eb" : "#e5e7eb",
              color: bold ? "#fff" : "#374151",
            }}
            onClick={() => setBold((b) => !b)}
          >
            B
          </button>
          <button
            style={{
              ...styles.toolBtn,
              fontStyle: "italic",
              background: italic ? "#2563eb" : "#e5e7eb",
              color: italic ? "#fff" : "#374151",
            }}
            onClick={() => setItalic((i) => !i)}
          >
            I
          </button>
          <div style={styles.colorRow}>
            {COLORS.map((c) => (
              <div
                key={c}
                onClick={() => setTextColor(c)}
                style={{
                  ...styles.colorDot,
                  background: c,
                  border:
                    textColor === c ? "3px solid #2563eb" : "2px solid #d1d5db",
                }}
              />
            ))}
          </div>
        </div>

        {/* Background */}
        <div style={styles.toolGroup}>
          <span style={styles.groupLabel}>Background</span>
          <div style={styles.colorRow}>
            {[...COLORS, "#0f172a", "#1e3a5f", "#064e3b", "#7f1d1d"].map(
              (c) => (
                <div
                  key={c}
                  onClick={() => setBgColor(c)}
                  style={{
                    ...styles.colorDot,
                    background: c,
                    border:
                      bgColor === c ? "3px solid #2563eb" : "2px solid #d1d5db",
                  }}
                />
              ),
            )}
          </div>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            style={{
              width: 36,
              height: 28,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          />
        </div>

        {/* Arrange / Delete */}
        <div style={styles.toolGroup}>
          <span style={styles.groupLabel}>Arrange</span>
          <button
            style={styles.toolBtn}
            onClick={bringForward}
            disabled={!selected}
          >
            ↑ Forward
          </button>
          <button
            style={styles.toolBtn}
            onClick={sendBackward}
            disabled={!selected}
          >
            ↓ Back
          </button>
          <button
            style={{
              ...styles.toolBtn,
              background: "#fee2e2",
              color: "#b91c1c",
            }}
            onClick={deleteSelected}
            disabled={!selected}
          >
            🗑 Delete
          </button>
          <button
            style={{
              ...styles.toolBtn,
              background: "#fef9c3",
              color: "#92400e",
            }}
            onClick={clearCanvas}
          >
            ✕ Clear All
          </button>
        </div>

        {/* Export */}
        <button style={styles.exportBtn} onClick={exportImage}>
          ✅ Use This Design
        </button>
      </div>

      {/* ── Canvas ── */}
      <div style={styles.canvasWrapper}>
        <div style={styles.canvasScaler}>
          <canvas ref={canvasEl} />
        </div>
        <div style={styles.canvasMeta}>1280 × 720 px · 16:9</div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
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
  textInput: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    width: 160,
  },
  select: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    background: "#f9fafb",
  },
  colorRow: { display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
  },
  exportBtn: {
    marginLeft: "auto",
    padding: "8px 20px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  canvasWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  canvasScaler: {
    width: "100%",
    maxWidth: "100%",
    overflow: "auto",
    background: "#1a1a2e",
    borderRadius: 10,
    padding: 16,
  },
  canvasMeta: { fontSize: 12, color: "#9ca3af" },
};
```

---

## STEP 3 — Wire the Designer into ContentManager

Open `src/pages/ContentManager.jsx` and make these changes:

**Add import at the top:**

```jsx
import FabricDesigner from "../components/FabricDesigner";
```

**Add state for the designer toggle:**

```jsx
const [showDesigner, setShowDesigner] = useState(false);
```

**Add this handler** (receives the exported file from the designer):

```jsx
const handleDesignExport = (file, previewUrl) => {
  setFile(file);
  setPreview(previewUrl);
  setShowDesigner(false); // close designer, back to upload form
};
```

**Replace the file input section** in the form with this:

```jsx
<label style={styles.label}>Signage Image</label>;

{
  /* Toggle between upload and designer */
}
<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
  <button
    type="button"
    style={{
      ...styles.modeBtn,
      background: !showDesigner ? "#2563eb" : "#f3f4f6",
      color: !showDesigner ? "#fff" : "#374151",
    }}
    onClick={() => setShowDesigner(false)}
  >
    📁 Upload File
  </button>
  <button
    type="button"
    style={{
      ...styles.modeBtn,
      background: showDesigner ? "#2563eb" : "#f3f4f6",
      color: showDesigner ? "#fff" : "#374151",
    }}
    onClick={() => setShowDesigner(true)}
  >
    🎨 Design Here
  </button>
</div>;

{
  !showDesigner && (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      onChange={handleFile}
      style={styles.fileInput}
    />
  );
}

{
  preview && !showDesigner && (
    <img
      src={preview}
      alt="preview"
      style={{
        width: "100%",
        borderRadius: 8,
        marginTop: 8,
        maxHeight: 200,
        objectFit: "cover",
      }}
    />
  );
}
```

**Render the designer below the form card** (outside the grid, full width):

```jsx
{
  showDesigner && (
    <section style={{ ...styles.card, marginTop: 24, gridColumn: "span 2" }}>
      <h2 style={styles.cardTitle}>🎨 Signage Designer</h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Design your announcement, then click <strong>Use This Design</strong> to
        attach it to the form above.
      </p>
      <FabricDesigner onExport={handleDesignExport} />
    </section>
  );
}
```

**Add the modeBtn style** to the styles object at the bottom:

```jsx
modeBtn: { padding: '7px 14px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
```

Also update the outer `<div style={styles.grid}>` to allow the designer to span full width:

```jsx
<div style={{ ...styles.grid, gridTemplateColumns: showDesigner ? '1fr' : '1fr 1fr' }}>
```

---

## STEP 4 — Test the Full Flow

```
1. Go to /content
2. Fill in Title + select Target Display
3. Click "🎨 Design Here"
4. Add text, shapes, background color, images
5. Click "✅ Use This Design"
       ↓
   Designer closes, image preview appears in the form
6. Click "🚀 Publish to Display"
       ↓
   Image saved to server → synced to Anthias by content_sync.py
```

---

## What the Designer Supports

| Feature                      | Supported                       |
| ---------------------------- | ------------------------------- |
| Add / edit text              | ✅                              |
| Font family & size           | ✅                              |
| Bold & italic                | ✅                              |
| Text color picker            | ✅                              |
| Background color             | ✅                              |
| Add rectangles & circles     | ✅                              |
| Upload & place images        | ✅                              |
| Drag, resize, rotate objects | ✅                              |
| Layer order (forward/back)   | ✅                              |
| Delete selected object       | ✅                              |
| Export as PNG → publish      | ✅                              |
| For complex designs          | Use external tool → Upload File |

That's the complete system. Every piece is now built and connected end to end.
