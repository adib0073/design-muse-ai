"use client";

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
}

export default function DesignResults({ result }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-xl font-bold mb-2">
          {result.theme} Design
        </h2>
        <p className="text-gray-400 text-sm">{result.floor_plan_analysis}</p>
        {result.overall_style_notes && (
          <p className="text-gray-300 text-sm mt-3 italic">
            {result.overall_style_notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {result.rooms.map((room) => (
          <RoomCard key={room.room_name} room={room} />
        ))}
      </div>
    </div>
  );
}

function getImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${apiUrl}${path}`;
}

function RoomCard({ room }: { room: RoomDesign }) {
  const imgUrl = getImageUrl(room.generated_image_url);
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
      {imgUrl && (
        <img
          src={imgUrl}
          alt={room.room_name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-5 space-y-4">
        <h3 className="text-lg font-bold">{room.room_name}</h3>
        <p className="text-sm text-gray-400">{room.description}</p>

        {/* Color Palette */}
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

        {/* Furniture */}
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

        {/* Materials */}
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
