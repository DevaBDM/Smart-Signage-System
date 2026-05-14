import { useEffect, useRef, useState } from "react";
import * as fabricModule from "fabric";

const fabric = fabricModule.fabric;
const CANVAS_W = 1280;
const CANVAS_H = 720;

const FONTS = ["Arial", "Georgia", "Courier New", "Verdana", "Trebuchet MS", "Impact"];
const COLORS = ["#ffffff", "#000000", "#1d4ed8", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2"];

export default function FabricCanvas({ 
  fabricRef, 
  canvasEl, 
  bgColor, 
  setSelected,
  text, 
  fontSize, 
  fontFamily, 
  textColor, 
  bold, 
  italic 
}) {

  useEffect(() => {
    if (canvasEl.current) {
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

      return () => {
        canvas.dispose();
        fabricRef.current = null;
      };
    }
  }, []);

  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.setBackgroundColor(bgColor, () => fabricRef.current.renderAll());
    }
  }, [bgColor]);

  return <canvas ref={canvasEl} />;
}
