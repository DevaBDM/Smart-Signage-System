import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";

export default function FabricDesigner({ onExport }) {
  const canvasRef = useRef(null);
  const [canvas, setCanvas] = useState(null);

  useEffect(() => {
    const c = new fabric.Canvas(canvasRef.current, {
      width: 1280,
      height: 720,
      backgroundColor: "#1a1a2e",
    });
    setCanvas(c);
    return () => c.dispose();
  }, []);

  const addText = () => {
    const text = new fabric.IText("Edit this text", {
      left: 100,
      top: 100,
      fontSize: 48,
      fill: "#ffffff",
      fontFamily: "Segoe UI",
      fontWeight: "bold",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
  };

  const addRect = () => {
    const rect = new fabric.Rect({
      left: 200,
      top: 200,
      width: 300,
      height: 80,
      fill: "#2563eb",
      rx: 12,
      ry: 12,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
  };

  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 300,
      top: 200,
      radius: 60,
      fill: "#7c3aed",
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
  };

  const setBackground = (color) => {
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
  };

  const addImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    fabric.Image.fromURL(url, (img) => {
      img.scaleToWidth(400);
      canvas.add(img);
      canvas.setActiveObject(img);
    });
  };

  const deleteSelected = () => {
    const obj = canvas.getActiveObject();
    if (obj) canvas.remove(obj);
  };

  const clearCanvas = () => {
    if (confirm("Clear everything?")) {
      canvas.clear();
      canvas.setBackgroundColor("#1a1a2e", canvas.renderAll.bind(canvas));
    }
  };

  const exportDesign = async () => {
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `design_${Date.now()}.png`, {
      type: "image/png",
    });
    onExport(file, dataUrl);
  };

  const bgColors = [
    "#1a1a2e",
    "#ffffff",
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#7c3aed",
    "#000000",
  ];

  return (
    <div>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button onClick={addText} style={s.toolBtn}>
          T Text
        </button>
        <button onClick={addRect} style={s.toolBtn}>
          ▬ Rectangle
        </button>
        <button onClick={addCircle} style={s.toolBtn}>
          ● Circle
        </button>
        <label style={s.toolBtn}>
          🖼 Image
          <input
            type="file"
            accept="image/*"
            onChange={addImage}
            style={{ display: "none" }}
          />
        </label>
        <div style={{ width: 1, background: "#e5e7eb", margin: "0 4px" }} />
        {bgColors.map((c) => (
          <button
            key={c}
            onClick={() => setBackground(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: c,
              border: "2px solid #d1d5db",
              cursor: "pointer",
            }}
          />
        ))}
        <div style={{ width: 1, background: "#e5e7eb", margin: "0 4px" }} />
        <button
          onClick={deleteSelected}
          style={{ ...s.toolBtn, color: "#dc2626" }}
        >
          🗑 Delete
        </button>
        <button
          onClick={clearCanvas}
          style={{ ...s.toolBtn, color: "#6b7280" }}
        >
          ✕ Clear
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={exportDesign} style={s.exportBtn}>
          💾 Export as Image
        </button>
      </div>

      {/* Canvas */}
      <div style={s.canvasWrapper}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  toolBtn: {
    padding: "7px 14px",
    borderRadius: 7,
    border: "1.5px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#374151",
  },
  exportBtn: {
    padding: "8px 18px",
    borderRadius: 8,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  canvasWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
    border: "1px solid #e5e7eb",
    display: "inline-block",
  },
};
