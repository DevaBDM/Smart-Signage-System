import * as fabricModule from "fabric";

const fabric = fabricModule.fabric;

export default function applyTemplate(canvas, preset, templateId, bgHex) {
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
