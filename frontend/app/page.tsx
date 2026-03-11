"use client";

import { useState } from "react";
import Header from "@/components/Header";
import FloorPlanUpload from "@/components/FloorPlanUpload";
import ThemeSelector from "@/components/ThemeSelector";
import DesignResults from "@/components/DesignResults";
import VisualizationPanel from "@/components/VisualizationPanel";
import LiveSession from "@/components/LiveSession";

type AppTab = "design" | "visualize" | "live";

interface DesignResult {
  theme: string;
  floor_plan_analysis: string;
  rooms: Array<{
    room_name: string;
    description: string;
    color_palette: string[];
    furniture_suggestions: string[];
    decoration_suggestions: string[];
    materials: string[];
    generated_image_url: string | null;
  }>;
  mood_board_url: string | null;
  overall_style_notes: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("design");
  const [floorPlan, setFloorPlan] = useState<File | null>(null);
  const [floorPlanPreview, setFloorPlanPreview] = useState<string>("");
  const [theme, setTheme] = useState("");
  const [designResult, setDesignResult] = useState<DesignResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFloorPlanUpload = (file: File) => {
    setFloorPlan(file);
    setFloorPlanPreview(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    if (!floorPlan || !theme) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("floor_plan", floorPlan);
      formData.append("theme", theme);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/design/generate`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Design generation failed");
      const data: DesignResult = await res.json();
      setDesignResult(data);
    } catch (err) {
      console.error("Failed to generate design:", err);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: AppTab; label: string; description: string }[] = [
    {
      id: "design",
      label: "Design",
      description: "Upload floor plan & generate themed designs",
    },
    {
      id: "visualize",
      label: "Visualize",
      description: "Generate room renders & video walkthrough",
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

            {designResult && <DesignResults result={designResult} />}
          </div>
        )}

        {activeTab === "visualize" && (
          <VisualizationPanel
            floorPlan={floorPlan}
            designResult={designResult}
          />
        )}

        {activeTab === "live" && (
          <LiveSession
            floorPlan={floorPlan}
            designResult={designResult}
          />
        )}
      </main>

      <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-500">
        Built with Google Gemini, Imagen 3, Veo 2 &amp; Google Cloud
      </footer>
    </div>
  );
}
