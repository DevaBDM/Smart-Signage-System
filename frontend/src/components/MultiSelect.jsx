import { useState, useRef, useEffect } from "react";

export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = "Search...",
  labelKey = "name",
  valueKey = "id",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedSet = new Set(value.map((v) => Number(v)));

  const filtered = query.trim()
    ? options.filter((o) =>
        String(o[labelKey]).toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const toggle = (id) => {
    const next = selectedSet.has(Number(id))
      ? value.filter((v) => Number(v) !== Number(id))
      : [...value, Number(id)];
    onChange(next);
  };

  const selectedItems = options.filter((o) => selectedSet.has(Number(o[valueKey])));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          padding: "6px 8px",
          minHeight: 38,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          cursor: "text",
          background: "#fff",
        }}
      >
        {selectedItems.length === 0 && (
          <span style={{ color: "#9ca3af", fontSize: 13 }}>{placeholder}</span>
        )}
        {selectedItems.map((item) => (
          <span
            key={item[valueKey]}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "#e0e7ff",
              color: "#3730a3",
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            {item[labelKey]}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(item[valueKey]);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                color: "#3730a3",
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          style={{
            border: "none",
            outline: "none",
            flex: 1,
            minWidth: 60,
            fontSize: 13,
            padding: 2,
            background: "transparent",
          }}
        />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 220,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: 10, color: "#6b7280", fontSize: 13 }}>
              No matches
            </div>
          )}
          {filtered.map((opt) => {
            const id = Number(opt[valueKey]);
            const checked = selectedSet.has(id);
            return (
              <div
                key={id}
                onClick={() => toggle(id)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: checked ? "#f3f4f6" : "transparent",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f9fafb")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = checked
                    ? "#f3f4f6"
                    : "transparent")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  style={{ cursor: "pointer" }}
                />
                {opt[labelKey]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
