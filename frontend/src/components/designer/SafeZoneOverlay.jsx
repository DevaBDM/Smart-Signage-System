export default function SafeZoneOverlay({ width, height, marginRatio = 0.06 }) {
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
