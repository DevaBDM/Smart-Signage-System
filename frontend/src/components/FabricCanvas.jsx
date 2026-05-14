import { useEffect, useRef } from "react";
import * as fabricModule from "fabric";

const fabric = fabricModule.fabric;

export default function FabricCanvas({
  fabricRef,
  canvasEl,
  width,
  height,
  bgColor,
  setSelected,
  onActiveStyleSync,
}) {
  const setSelectedRef = useRef(setSelected);
  const onSyncRef = useRef(onActiveStyleSync);

  useEffect(() => {
    setSelectedRef.current = setSelected;
    onSyncRef.current = onActiveStyleSync;
  }, [setSelected, onActiveStyleSync]);

  useEffect(() => {
    if (!canvasEl.current) return;
    const canvas = new fabric.Canvas(canvasEl.current, {
      width,
      height,
      backgroundColor: bgColor,
      selection: true,
    });
    fabricRef.current = canvas;

    const pushSelection = () => {
      const active = canvas.getActiveObject();
      setSelectedRef.current?.(active ?? null);
    };

    const pushStyleSync = () => {
      onSyncRef.current?.();
    };

    canvas.on("selection:created", pushSelection);
    canvas.on("selection:updated", pushSelection);
    canvas.on("selection:cleared", () => {
      setSelectedRef.current?.(null);
    });

    canvas.on("object:modified", (e) => {
      if (e.target && e.target === canvas.getActiveObject()) pushStyleSync();
    });
    canvas.on("editing:exited", (e) => {
      if (e.target && e.target === canvas.getActiveObject()) pushStyleSync();
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
    // Intentionally only width/height: new Fabric.Canvas when slide size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.setBackgroundColor(bgColor, () =>
        fabricRef.current.renderAll(),
      );
    }
  }, [bgColor, fabricRef]);

  return <canvas ref={canvasEl} />;
}
