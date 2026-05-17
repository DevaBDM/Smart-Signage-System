import { useCallback, useRef, useState } from "react";

/**
 * Single timeline with selectable start/end handles.
 * Click a handle (or its button) to select it, then drag the track or handle to move only that edge.
 */
export default function VideoTrimSlider({
  duration,
  start,
  end,
  minGap = 0.5,
  onChange,
}) {
  const trackRef = useRef(null);
  const [active, setActive] = useState("start");
  const dragging = useRef(false);

  const d = Math.max(minGap, Number(duration) || minGap);
  const safeStart = Math.max(0, Math.min(start, d - minGap));
  const safeEnd = Math.max(safeStart + minGap, Math.min(end, d));
  const clipLen = safeEnd - safeStart;

  const startPct = (safeStart / d) * 100;
  const endPct = (safeEnd / d) * 100;

  const timeFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * d;
    },
    [d],
  );

  const applyTime = useCallback(
    (handle, rawTime) => {
      const t = Math.max(0, Math.min(rawTime, d));
      if (handle === "start") {
        onChange({ start: Math.min(t, safeEnd - minGap), end: safeEnd });
      } else {
        onChange({ start: safeStart, end: Math.max(t, safeStart + minGap) });
      }
    },
    [d, minGap, onChange, safeEnd, safeStart],
  );

  const onPointerDown = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(handle);
    dragging.current = true;

    const move = (ev) => applyTime(handle, timeFromClientX(ev.clientX));
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    applyTime(handle, timeFromClientX(e.clientX));
  };

  const onTrackPointerDown = (e) => {
    applyTime(active, timeFromClientX(e.clientX));
  };

  const thumbStyle = (handle) => {
    const selected = active === handle;
    return {
      position: "absolute",
      top: "50%",
      left: handle === "start" ? `${startPct}%` : `${endPct}%`,
      transform: "translate(-50%, -50%)",
      width: 18,
      height: 18,
      borderRadius: "50%",
      border: `3px solid ${selected ? "#2563eb" : "#fff"}`,
      background: selected ? "#2563eb" : "#fff",
      boxShadow: "0 1px 6px rgba(0,0,0,0.35)",
      cursor: "grab",
      zIndex: selected ? 4 : 3,
      touchAction: "none",
    };
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div>
        <span style={{ fontSize: 12, color: "#374151" }}>
          {safeStart.toFixed(1)}s — {safeEnd.toFixed(1)}s
          <span style={{ color: "#6b7280" }}>
            {" "}
            (clip {clipLen.toFixed(1)}s / {d.toFixed(1)}s)
          </span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setActive("start")}
          style={handleBtn(active === "start")}
        >
          Trim start
        </button>
        <button
          type="button"
          onClick={() => setActive("end")}
          style={handleBtn(active === "end")}
        >
          Trim end
        </button>
      </div>

      <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 4px" }}>
        {active === "start"
          ? "Moving start — click Trim end to adjust the other side"
          : "Moving end — click Trim start to adjust the other side"}
      </p>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Video trim timeline"
        onPointerDown={onTrackPointerDown}
        style={{
          position: "relative",
          height: 40,
          marginTop: 4,
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 16,
            height: 8,
            borderRadius: 4,
            background: "#e5e7eb",
          }}
        />
        <div>
          <div
            style={{
              position: "absolute",
              top: 16,
              height: 8,
              left: `${startPct}%`,
              width: `${Math.max(0, endPct - startPct)}%`,
              borderRadius: 4,
              background: "#2563eb",
              pointerEvents: "none",
            }}
          />
        </div>
        <div
          style={thumbStyle("start")}
          onPointerDown={(e) => onPointerDown("start", e)}
          role="presentation"
        />
        <div
          style={thumbStyle("end")}
          onPointerDown={(e) => onPointerDown("end", e)}
          role="presentation"
        />
      </div>
    </div>
  );
}

function handleBtn(selected) {
  return {
    flex: 1,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: selected ? "2px solid #2563eb" : "1px solid #d1d5db",
    background: selected ? "#eff6ff" : "#fff",
    color: selected ? "#1d4ed8" : "#374151",
    cursor: "pointer",
  };
}
