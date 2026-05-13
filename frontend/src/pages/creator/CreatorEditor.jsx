import { useState } from "react";
import CreatorSidebar from "../../components/CreatorSidebar";
import FabricDesigner from "../../components/FabricDesigner";
import * as S from "../../styles";

export default function CreatorEditor() {
  const [exported, setExported] = useState(null);

  const handleExport = (file, previewUrl) => setExported({ file, previewUrl });

  return (
    <div style={S.layout}>
      <CreatorSidebar />
      <main style={S.main}>
        <h1 style={S.heading}>Poster Designer</h1>
        <p style={S.sub}>
          Design a signage poster then go to My Posts to attach and publish it.
        </p>
        {exported && (
          <div
            style={{
              ...S.card,
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
            }}
          >
            <img
              src={exported.previewUrl}
              style={{
                width: 80,
                height: 45,
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
            <div>
              <div style={{ fontWeight: 600, color: "#166534" }}>
                ✅ Design exported — {exported.file.name}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Go to My Posts, create a new post and upload this image.
              </div>
            </div>
          </div>
        )}
        <div style={S.card}>
          <FabricDesigner onExport={handleExport} />
        </div>
      </main>
    </div>
  );
}
