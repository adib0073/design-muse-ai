"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  renders?: Array<{ room_name: string; render_url: string }>;
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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/live/start`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to start session");
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages([
        {
          role: "agent",
          content: `Live design session started! I've loaded your ${designResult.theme} design. What changes would you like to make? You can ask me to swap furniture, change colors, adjust layouts, and more.`,
        },
      ]);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/live/message`, {
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
        },
      ]);
    } catch (err) {
      console.error("Message failed:", err);
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "Something went wrong. Please try again." },
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
          furniture, colors, layouts and see updates instantly.
        </p>
        <button
          onClick={startSession}
          disabled={starting}
          className="py-3 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
        >
          {starting ? "Starting session..." : "Start Session"}
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
              <p className="text-sm">{msg.content}</p>
              {msg.renders && msg.renders.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {msg.renders.map((r, j) => (
                    <img
                      key={j}
                      src={r.render_url}
                      alt={r.room_name}
                      className="rounded-lg w-full"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
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
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
