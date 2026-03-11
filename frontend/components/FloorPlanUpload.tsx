"use client";

import { useCallback } from "react";

interface Props {
  onUpload: (file: File) => void;
  preview: string;
}

export default function FloorPlanUpload({ onUpload, preview }: Props) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Floor Plan</h2>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer min-h-[300px] flex items-center justify-center"
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {preview ? (
          <img
            src={preview}
            alt="Floor plan preview"
            className="max-h-[280px] rounded-lg object-contain"
          />
        ) : (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
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
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div>
              <p className="text-gray-300 font-medium">
                Drop your floor plan here
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to browse — PNG, JPG, sketch, or blueprint
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
