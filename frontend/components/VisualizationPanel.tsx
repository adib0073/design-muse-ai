"use client";

import { useState } from "react";

interface Props {
  floorPlan: File | null;
  designResult: any | null;
}

export default function VisualizationPanel({ floorPlan, designResult }: Props) {
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setReferenceImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleGenerate = async () => {
    if (!floorPlan || !designResult) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("floor_plan", floorPlan);
      formData.append("theme", designResult.theme);
      referenceImages.forEach((img) => formData.append("reference_images", img));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/visualize/render`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Visualization failed");
      setResult(await res.json());
    } catch (err) {
      console.error("Visualization failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!designResult) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">Generate a design first</p>
        <p className="text-sm mt-2">
          Switch to the Design tab to upload a floor plan and generate your design.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Reference Image Upload */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">
          Upload Reference Images (Optional)
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Upload photos of furniture, existing rooms, or inspiration images.
          The AI will incorporate these into your visualization.
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          {previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Reference ${i + 1}`}
              className="w-24 h-24 object-cover rounded-lg border border-gray-700"
            />
          ))}
          <label className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleReferenceUpload}
              className="hidden"
            />
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </label>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
        >
          {loading ? "Generating visualization..." : "Generate Room Renders & Video"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {result.video_url && (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-4">
                Apartment Walkthrough
              </h3>
              <video
                src={result.video_url}
                controls
                className="w-full rounded-xl"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.rooms?.map((room: any) => (
              <div
                key={room.room_name}
                className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800"
              >
                {room.render_url && (
                  <img
                    src={room.render_url}
                    alt={room.room_name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-5">
                  <h4 className="font-bold">{room.room_name}</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {room.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
