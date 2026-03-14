export default function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="DesignMuse"
            className="h-10 w-10 rounded-xl object-cover"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Design<span className="text-indigo-400">Muse</span> AI
            </h1>
            <p className="text-xs text-gray-500">
              AI-Powered Interior Design Agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-800 rounded-md">
            Powered by Gemini
          </span>
        </div>
      </div>
    </header>
  );
}
