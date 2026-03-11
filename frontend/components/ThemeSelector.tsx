"use client";

const PRESET_THEMES = [
  { id: "greek-mediterranean", label: "Greek Mediterranean", emoji: "🏛️" },
  { id: "japanese-zen", label: "Japanese Zen", emoji: "🎋" },
  { id: "industrial-loft", label: "Industrial Loft", emoji: "🏗️" },
  { id: "scandinavian-minimal", label: "Scandinavian Minimal", emoji: "🌿" },
  { id: "art-deco", label: "Art Deco", emoji: "✨" },
  { id: "bohemian", label: "Bohemian", emoji: "🌸" },
  { id: "mid-century-modern", label: "Mid-Century Modern", emoji: "🪑" },
  { id: "coastal", label: "Coastal", emoji: "🌊" },
];

interface Props {
  selectedTheme: string;
  onSelect: (theme: string) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  loading: boolean;
}

export default function ThemeSelector({
  selectedTheme,
  onSelect,
  onGenerate,
  canGenerate,
  loading,
}: Props) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Choose a Theme</h2>

      <div className="grid grid-cols-2 gap-2">
        {PRESET_THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onSelect(theme.label)}
            className={`p-3 rounded-xl text-left text-sm transition-all ${
              selectedTheme === theme.label
                ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <span className="mr-2">{theme.emoji}</span>
            {theme.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        <input
          type="text"
          placeholder="Or type a custom theme..."
          value={selectedTheme}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        onClick={onGenerate}
        disabled={!canGenerate || loading}
        className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Designing your space...
          </span>
        ) : (
          "Generate Design"
        )}
      </button>
    </div>
  );
}
