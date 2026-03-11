"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import FloorPlanUpload from "@/components/FloorPlanUpload";
import ThemeSelector from "@/components/ThemeSelector";
import DesignResults from "@/components/DesignResults";
import VisualizationPanel from "@/components/VisualizationPanel";
import LiveSession, { type ChatMessage } from "@/components/LiveSession";

type AppTab = "design" | "visualize" | "live";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("design");
  const [floorPlan, setFloorPlan] = useState<File | null>(null);
  const [floorPlanPreview, setFloorPlanPreview] = useState<string>("");
  const [theme, setTheme] = useState("");
  const [designResult, setDesignResult] = useState<DesignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageProgress, setImageProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  // Lifted video state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Lifted live session state
  const [liveSessionId, setLiveSessionId] = useState<string>("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);

  const handleFloorPlanUpload = (file: File) => {
    setFloorPlan(file);
    setFloorPlanPreview(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    if (!floorPlan || !theme) return;
    setLoading(true);
    setDesignResult(null);
    setImageProgress(null);
    setVideoUrl(null);

    try {
      const formData = new FormData();
      formData.append("floor_plan", floorPlan);
      formData.append("theme", theme);

      const res = await fetch(`${API_URL}/api/design/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Design generation failed");

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

            if (event.type === "design_text") {
              const design: DesignResult = event.data;
              setDesignResult(design);
              setImageProgress({ completed: 0, total: design.rooms.length });
            } else if (event.type === "room_image") {
              const { room_name, image_url } = event.data;
              setDesignResult((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  rooms: prev.rooms.map((room) =>
                    room.room_name === room_name
                      ? { ...room, generated_image_url: image_url }
                      : room
                  ),
                };
              });
              setImageProgress((prev) =>
                prev ? { ...prev, completed: prev.completed + 1 } : prev
              );
            } else if (event.type === "complete") {
              setImageProgress(null);
            } else if (event.type === "error") {
              console.error("Stream error:", event.message);
            }
          } catch {
            // partial JSON — will complete on next chunk
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate design:", err);
    } finally {
      setLoading(false);
      setImageProgress(null);
    }
  };

  const handleDesignUpdate = useCallback(
    (roomName: string, newImageUrl: string) => {
      setDesignResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rooms: prev.rooms.map((room) =>
            room.room_name === roomName
              ? { ...room, generated_image_url: newImageUrl }
              : room
          ),
        };
      });
    },
    []
  );

  const handleResetSession = useCallback(() => {
    setLiveSessionId("");
    setLiveMessages([]);
  }, []);

  const tabs: { id: AppTab; label: string; description: string }[] = [
    {
      id: "design",
      label: "Design",
      description: "Upload floor plan & generate themed designs",
    },
    {
      id: "visualize",
      label: "Visualize",
      description: "Video walkthrough of your design",
    },
    {
      id: "live",
      label: "Live Session",
      description: "Interactive real-time design changes",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 bg-gray-900 p-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <div className="font-semibold">{tab.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{tab.description}</div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "design" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FloorPlanUpload
                onUpload={handleFloorPlanUpload}
                preview={floorPlanPreview}
              />
              <ThemeSelector
                selectedTheme={theme}
                onSelect={setTheme}
                onGenerate={handleGenerate}
                canGenerate={!!floorPlan && !!theme}
                loading={loading}
              />
            </div>

            {designResult && (
              <DesignResults
                result={designResult}
                imageProgress={imageProgress}
              />
            )}
          </div>
        )}

        {activeTab === "visualize" && (
          <VisualizationPanel
            designResult={designResult}
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
          />
        )}

        {activeTab === "live" && (
          <LiveSession
            floorPlan={floorPlan}
            designResult={designResult}
            onDesignUpdate={handleDesignUpdate}
            sessionId={liveSessionId}
            onSessionIdChange={setLiveSessionId}
            messages={liveMessages}
            onMessagesChange={setLiveMessages}
            onResetSession={handleResetSession}
          />
        )}
      </main>

      <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-500">
        Built with Google Gemini, Imagen 3, Veo 3.1 &amp; Google Cloud
      </footer>
    </div>
  );
}
