"use client";

import { useState, useRef, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function resolveUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  renders?: Array<{ room_name: string; render_url: string }>;
  changes?: string[];
}

interface Props {
  floorPlan: File | null;
  designResult: any | null;
}

export default function LiveSession({ floorPlan, designResult }: Props) {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startSession = async () => {
    if (!floorPlan || !designResult) return;
    setStarting(true);

    try {
      const formData = new FormData();
      formData.append("floor_plan", floorPlan);
      formData.append("theme", designResult.theme);

      const res = await fetch(`${API_URL}/api/live/start`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to start session");
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages([
        {
          role: "agent",
          content: `Live design session started! I've loaded your ${designResult.theme} design with ${designResult.rooms?.length || 0} rooms. What changes would you like to make? Try things like:\n\n- "Change the living room sofa to dark leather"\n- "Make the bedroom curtains a deeper blue"\n- "Add a bookshelf to the alcove"\n- "Try warmer lighting in the kitchen"`,
        },
      ]);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/live/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          context: {},
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.agent_message,
          renders: data.updated_renders,
          changes: data.design_changes,
        },
      ]);
    } catch (err) {
      console.error("Message failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!designResult) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-lg">Generate a design first</p>
        <p className="text-sm mt-2">
          Switch to the Design tab to create your initial design, then come back
          here to make live changes.
        </p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Start a Live Design Session</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
          Chat with your AI interior designer in real-time. Request changes to
          furniture, colors, layouts and see updated renders instantly.
        </p>
        <button
          onClick={startSession}
          disabled={starting}
          className="py-3 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
        >
          {starting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading design...
            </span>
          ) : (
            "Start Session"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 flex flex-col h-[600px]">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{msg.content}</p>

              {/* Design changes list */}
              {msg.changes && msg.changes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.changes.map((change, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs text-indigo-300">
                      <span className="mt-0.5">*</span>
                      <span>{change}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rendered room images */}
              {msg.renders && msg.renders.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {msg.renders.map((r, j) => {
                    const imgUrl = resolveUrl(r.render_url);
                    return imgUrl ? (
                      <div key={j}>
                        <img
                          src={imgUrl}
                          alt={r.room_name}
                          className="rounded-lg w-full"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-center">
                          {r.room_name}
                        </p>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
                <span className="text-xs text-gray-500">
                  Updating design...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Try: 'Change the living room sofa to a dark leather sectional'"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
