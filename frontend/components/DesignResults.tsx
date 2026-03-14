"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

interface RoomDesign {
  room_name: string;
  description: string;
  color_palette: string[];
  furniture_suggestions: string[];
  decoration_suggestions: string[];
  materials: string[];
  generated_image_url: string | null;
}

interface DesignResult {
  theme: string;
  floor_plan_analysis: string;
  rooms: RoomDesign[];
  mood_board_url: string | null;
  overall_style_notes: string;
}

interface Props {
  result: DesignResult;
  imageProgress?: { completed: number; total: number } | null;
}

export default function DesignResults({ result, imageProgress }: Props) {
  const [lightbox, setLightbox] = useState<{
    url: string;
    room: RoomDesign;
  } | null>(null);

  const allImages = result.rooms
    .filter((r) => r.generated_image_url)
    .map((r) => ({
      url: getImageUrl(r.generated_image_url)!,
      room: r,
    }));

  const navigateLightbox = (direction: number) => {
    if (!lightbox) return;
    const idx = allImages.findIndex((img) => img.url === lightbox.url);
    const next = (idx + direction + allImages.length) % allImages.length;
    setLightbox(allImages[next]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-2">
          Your {result.theme} Design &mdash; {result.rooms.length} Spaces
        </h2>
        <p className="text-gray-400 text-sm">{result.floor_plan_analysis}</p>
        {result.overall_style_notes && (
          <p className="text-gray-300 text-sm mt-3 italic">
            {result.overall_style_notes}
          </p>
        )}

        {/* Image generation progress bar */}
        {imageProgress && imageProgress.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>
                Generating images: {imageProgress.completed} / {imageProgress.total} spaces
              </span>
              <span>
                {Math.round((imageProgress.completed / imageProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(imageProgress.completed / imageProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {result.rooms.map((room) => (
          <RoomCard
            key={room.room_name}
            room={room}
            isGenerating={
              imageProgress !== null &&
              imageProgress !== undefined &&
              !room.generated_image_url
            }
            onImageClick={(url) => setLightbox({ url, room })}
          />
        ))}
      </div>

      {/* Lightbox / Fullscreen Preview */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {allImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <div
            className="max-w-5xl w-full mx-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.room.room_name}
              className="max-h-[70vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">
                {lightbox.room.room_name}
              </h3>
              <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                {lightbox.room.description}
              </p>
              {lightbox.room.color_palette.length > 0 && (
                <div className="flex gap-2 justify-center mt-3">
                  {lightbox.room.color_palette.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-lg border border-white/20 shadow-md"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {allImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {allImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/50">
              {allImages.findIndex((img) => img.url === lightbox.url) + 1} / {allImages.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

function RoomCard({
  room,
  isGenerating,
  onImageClick,
}: {
  room: RoomDesign;
  isGenerating?: boolean;
  onImageClick: (url: string) => void;
}) {
  const imgUrl = getImageUrl(room.generated_image_url);
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {imgUrl ? (
        <div
          className="relative group cursor-pointer"
          onClick={() => onImageClick(imgUrl)}
        >
          <img
            src={imgUrl}
            alt={room.room_name}
            className="w-full h-48 object-cover transition-transform group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
              />
            </svg>
          </div>
        </div>
      ) : isGenerating ? (
        <div className="w-full h-48 bg-gray-800 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-gray-500">Generating image&hellip;</span>
        </div>
      ) : null}

      <div className="p-5 space-y-4">
        <h3 className="text-lg font-bold">{room.room_name}</h3>
        <p className="text-sm text-gray-400">{room.description}</p>

        {room.color_palette.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Color Palette
            </p>
            <div className="flex gap-2">
              {room.color_palette.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-lg border border-gray-700"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] text-gray-500">{color}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {room.furniture_suggestions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Furniture
            </p>
            <div className="flex flex-wrap gap-1.5">
              {room.furniture_suggestions.map((item, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-gray-800 rounded-md text-xs text-gray-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {room.materials.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Materials
            </p>
            <div className="flex flex-wrap gap-1.5">
              {room.materials.map((mat, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-indigo-900/30 text-indigo-300 rounded-md text-xs"
                >
                  {mat}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
