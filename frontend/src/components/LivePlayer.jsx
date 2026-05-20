import { useRef, useEffect, useState } from "react";

function canPlayNativeHLS(video) {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

export default function LivePlayer({
  src,
  autoPlay = true,
  muted = true,
  controls = true,
  style = {},
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState("");
  const [hlsReady, setHlsReady] = useState(false);

  useEffect(() => {
    if (!src || !videoRef.current) return;
    setError("");

    const video = videoRef.current;
    let destroyed = false;

    const init = async () => {
      try {
        if (canPlayNativeHLS(video)) {
          video.src = src;
          if (autoPlay) video.play().catch(() => {});
          return;
        }

        const Hls = (await import("hls.js")).default;
        if (destroyed) return;

        if (!Hls.isSupported()) {
          setError("HLS playback is not supported in this browser.");
          return;
        }

        const hls = new Hls({
          maxBufferLength: 30,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError("Stream unavailable (network error).");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError("Fatal playback error.");
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setHlsReady(true);
          if (autoPlay) video.play().catch(() => {});
        });

        hls.loadSource(src);
        hls.attachMedia(video);
      } catch (e) {
        if (!destroyed) setError("Failed to load HLS player.");
      }
    };

    init();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, autoPlay]);

  if (!src) {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#888",
          fontSize: 14,
        }}
      >
        No stream source
      </div>
    );
  }

  return (
    <div style={{ position: "relative", ...style }}>
      <video
        ref={videoRef}
        muted={muted}
        controls={controls}
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
          display: "block",
        }}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: 16,
            textAlign: "center",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
      {!hlsReady && !error && !canPlayNativeHLS(videoRef.current) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 14,
          }}
        >
          Loading stream…
        </div>
      )}
    </div>
  );
}
