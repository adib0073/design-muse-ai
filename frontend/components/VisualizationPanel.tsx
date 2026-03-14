"use client";

import { useState } from "react";

interface RoomDesign {
  room_name: string;
  description: string;
  generated_image_url: string | null;
}

interface Props {
  designResult: any | null;
  videoUrl: string | null;
  onVideoUrlChange: (url: string | null) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function resolveUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export default function VisualizationPanel({
  designResult,
  videoUrl,
  onVideoUrlChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoFullscreen, setVideoFullscreen] = useState(false);
  const [clipProgress, setClipProgress] = useState<{
    current: number;
    total: number;
    room_name: string;
    phase: "generating" | "stitching";
  } | null>(null);

  if (!designResult) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">Generate a design first</p>
        <p className="text-sm mt-2">
          Switch to the Design tab to upload a floor plan and generate your
          design.
        </p>
      </div>
    );
  }

  const roomImages: RoomDesign[] = (designResult.rooms || []).filter(
    (r: RoomDesign) => r.generated_image_url
  );

  const handleGenerateVideo = async () => {
    if (roomImages.length === 0) return;
    setLoading(true);
    setError("");
    setClipProgress(null);

    try {
      const imageUrls = roomImages.map((r) => r.generated_image_url!);

      const res = await fetch(`${API_URL}/api/visualize/walkthrough`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_urls: imageUrls }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "progress") {
              setClipProgress({
                current: event.data.current,
                total: event.data.total,
                room_name: event.data.room_name,
                phase: "generating",
              });
            } else if (event.type === "stitching") {
              setClipProgress((prev) =>
                prev
                  ? { ...prev, phase: "stitching", room_name: "Preparing video..." }
                  : null
              );
            } else if (event.type === "complete") {
              onVideoUrlChange(event.data.video_url);
              setClipProgress(null);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) {
              throw e;
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Video generation failed:", err);
      setError(err.message || "Video generation failed. Please try again.");
    } finally {
      setLoading(false);
      setClipProgress(null);
    }
  };

  const progressPct = clipProgress
    ? Math.round((clipProgress.current / clipProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-2">
          Your {designResult.theme} Design &mdash; {roomImages.length} Spaces
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          These are the designs generated in the Design tab. The walkthrough
          video will cover every space.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
          {roomImages.map((room) => {
            const imgUrl = resolveUrl(room.generated_image_url);
            return (
              <div
                key={room.room_name}
                className="rounded-lg overflow-hidden border border-gray-700"
              >
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt={room.room_name}
                    className="w-full h-24 object-cover"
                  />
                )}
                <p className="text-xs text-gray-400 text-center py-1.5 bg-gray-800">
                  {room.room_name}
                </p>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {clipProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>
                {clipProgress.phase === "stitching"
                  ? "Generating walkthrough video..."
                  : `Generating video ${clipProgress.current}/${clipProgress.total}: ${clipProgress.room_name}`}
              </span>
              <span>{clipProgress.phase === "stitching" ? "99%" : `${progressPct}%`}</span>
            </div>
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  clipProgress.phase === "stitching"
                    ? "bg-gradient-to-r from-yellow-500 to-amber-500 animate-pulse"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500"
                }`}
                style={{
                  width:
                    clipProgress.phase === "stitching"
                      ? "99%"
                      : `${progressPct}%`,
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateVideo}
          disabled={loading || roomImages.length === 0}
          className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {clipProgress
                ? clipProgress.phase === "stitching"
                  ? "Preparing final video..."
                  : `Progress - ${progressPct}%`
                : "Starting..."}
            </span>
          ) : videoUrl ? (
            "Regenerate Walkthrough Video"
          ) : (
            "Generate Walkthrough Video"
          )}
        </button>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Video Result */}
      {videoUrl && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Apartment Walkthrough</h3>
            <button
              onClick={() => setVideoFullscreen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
              Fullscreen
            </button>
          </div>
          <video
            src={resolveUrl(videoUrl)!}
            controls
            className="w-full rounded-xl"
          />
        </div>
      )}

      {/* Video Fullscreen Modal */}
      {videoFullscreen && videoUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onClick={() => setVideoFullscreen(false)}
        >
          <button
            onClick={() => setVideoFullscreen(false)}
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <video
            src={resolveUrl(videoUrl)!}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[95vw] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
