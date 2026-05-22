import * as S from "../styles";

export default function SignageAssetList({
  assets,
  selectedDeviceId,
  assetLoading,
  onRefresh,
  onControl,
  onToggleEnabled,
  onDelete,
  formatDuration,
  selectedAssetIds,
  onToggleSelect,
  onSelectAll,
  onBulkHide,
  onBulkShow,
  onBulkDelete,
}) {
  return (
    <div style={S.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontWeight: 700 }}>Display Assets</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!selectedDeviceId || assetLoading}
          style={{ ...S.btn, padding: "6px 10px" }}
        >
          {assetLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {selectedDeviceId && assets.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
            padding: "8px 10px",
            background: "#f9fafb",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={
                assets.length > 0 &&
                assets.filter((a) => a.can_manage).every((a) => selectedAssetIds.has(a.asset_id))
              }
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            Select all
          </label>
          {selectedAssetIds.size > 0 && (
            <>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {selectedAssetIds.size} selected
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={onBulkHide}
                  style={{ ...S.btn, padding: "4px 10px", fontSize: 12 }}
                >
                  Hide
                </button>
                <button
                  type="button"
                  onClick={onBulkShow}
                  style={{ ...S.btn, padding: "4px 10px", fontSize: 12 }}
                >
                  Show
                </button>
                <button
                  type="button"
                  onClick={onBulkDelete}
                  style={{
                    ...S.btn,
                    padding: "4px 10px",
                    fontSize: 12,
                    background: "#fee2e2",
                    color: "#b91c1c",
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => onControl("previous")}
          disabled={!selectedDeviceId}
          style={{ ...S.btn, padding: "6px 10px" }}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onControl("next")}
          disabled={!selectedDeviceId}
          style={{ ...S.btn, padding: "6px 10px" }}
        >
          Next
        </button>
      </div>

      {!selectedDeviceId && (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
          Select a display to see its assets.
        </p>
      )}

      {selectedDeviceId && assets.length === 0 && !assetLoading && (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: 32 }}>
          No assets on this display yet.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {assets.map((asset) => (
          <div
            key={asset.asset_id}
            style={{
              display: "grid",
              gridTemplateColumns: asset.can_manage ? "28px 72px 1fr" : "72px 1fr",
              gap: 12,
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            {asset.can_manage && (
              <input
                type="checkbox"
                checked={selectedAssetIds.has(asset.asset_id)}
                onChange={() => onToggleSelect(asset.asset_id)}
                style={{ justifySelf: "center" }}
              />
            )}
            {asset.preview_url && asset.is_video ? (
              <video
                src={asset.preview_url}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 6,
                  background: "#111",
                }}
              />
            ) : asset.preview_url ? (
              <img
                src={asset.preview_url}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 6,
                  background: "#f3f4f6",
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 6,
                  background: "#f3f4f6",
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {asset.name || "Untitled asset"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                {asset.is_live_stream
                  ? "Live Stream"
                  : asset.is_video
                    ? "Video"
                    : "Image"} ·{" "}
                {asset.is_enabled ? "Visible" : "Hidden"} ·{" "}
                {formatDuration(asset)}
                {!asset.can_manage ? " · view only" : ""}
              </div>
              {asset.can_manage ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onControl("start", asset.asset_id)}
                    style={{ ...S.btn, padding: "5px 9px" }}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleEnabled(asset, !asset.is_enabled)}
                    style={{ ...S.btn, padding: "5px 9px" }}
                  >
                    {asset.is_enabled ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(asset)}
                    style={{
                      ...S.btn,
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "5px 9px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
