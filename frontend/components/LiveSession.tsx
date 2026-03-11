"use client";

import { useState, useRef, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function resolveUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

interface RoomRender {
  room_name: string;
  render_url: string;
}

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  renders?: RoomRender[];
  changes?: string[];
  confirmed?: boolean;
  attachedImageUrl?: string;
}

interface Props {
  floorPlan: File | null;
  designResult: any | null;
  onDesignUpdate?: (roomName: string, newImageUrl: string) => void;
  sessionId: string;
  onSessionIdChange: (id: string) => void;
  messages: ChatMessage[];
  onMessagesChange: (msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onResetSession: () => void;
}

export default function LiveSession({
  floorPlan,
  designResult,
  onDesignUpdate,
  sessionId,
  onSessionIdChange,
  messages,
  onMessagesChange,
  onResetSession,
}: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string>("");
  const [lightbox, setLightbox] = useState<{
    url: string;
    roomName: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedImage(file);
    setAttachedPreview(URL.createObjectURL(file));
  };

  const clearAttachment = () => {
    setAttachedImage(null);
    setAttachedPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      onSessionIdChange(data.session_id);

      const spacesWithImages = (designResult.rooms || []).filter(
        (r: any) => r.generated_image_url
      ).length;

      onMessagesChange([
        {
          role: "agent",
          content:
            `Live design session started! I've loaded your ${designResult.theme} design ` +
            `with ${designResult.rooms?.length || 0} spaces ` +
            `(${spacesWithImages} with generated images).\n\n` +
            `Your floor plan and all design details are loaded in context.\n\n` +
            `What changes would you like to make? You can also attach a photo of ` +
            `furniture or decor you want to use. Try:\n\n` +
            `- "Change the living room sofa to dark leather"\n` +
            `- "Add a bookshelf to the alcove"\n` +
            `- Upload an image of a chair and say "Use this chair in Bedroom-01"`,
        },
      ]);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || !sessionId || loading) return;

    const userMessage = input.trim();
    const imageFile = attachedImage;
    const imagePreview = attachedPreview;

    setInput("");
    clearAttachment();

    onMessagesChange((prev: ChatMessage[]) => [
      ...prev,
      {
        role: "user" as const,
        content: userMessage || "(attached image)",
        attachedImageUrl: imagePreview || undefined,
      },
    ]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("message", userMessage || "Please analyze the attached image and incorporate it into the design.");
      if (imageFile) {
        formData.append("reference_image", imageFile);
      }

      const res = await fetch(`${API_URL}/api/live/message`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      onMessagesChange((prev: ChatMessage[]) => [
        ...prev,
        {
          role: "agent" as const,
          content: data.agent_message,
          renders: data.updated_renders,
          changes: data.design_changes,
          confirmed: false,
        },
      ]);
    } catch (err) {
      console.error("Message failed:", err);
      onMessagesChange((prev: ChatMessage[]) => [
        ...prev,
        {
          role: "agent" as const,
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.renders || !onDesignUpdate) return;

    for (const render of msg.renders) {
      await fetch(`${API_URL}/api/live/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_name: render.room_name,
          new_image_url: render.render_url,
        }),
      });
      onDesignUpdate(render.room_name, render.render_url);
    }

    onMessagesChange((prev: ChatMessage[]) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, confirmed: true } : m))
    );
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
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Start a Live Design Session</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
          Chat with your AI interior designer in real-time. Request changes,
          upload reference photos of furniture or styles, and see updated renders
          instantly.
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
              Loading design context...
            </span>
          ) : (
            "Start Session"
          )}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 rounded-2xl border border-gray-800 flex flex-col h-[600px]">
        {/* Session Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-400">
              Live session &mdash; {designResult.theme}
            </span>
          </div>
          <button
            onClick={onResetSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            New Session
          </button>
        </div>

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
                {/* User's attached image */}
                {msg.attachedImageUrl && (
                  <div className="mb-2">
                    <img
                      src={msg.attachedImageUrl}
                      alt="Reference"
                      className="max-h-32 rounded-lg border border-white/20 cursor-pointer"
                      onClick={() =>
                        setLightbox({
                          url: msg.attachedImageUrl!,
                          roomName: "Reference Image",
                        })
                      }
                    />
                    <p className="text-xs opacity-60 mt-1">Attached reference</p>
                  </div>
                )}

                <p className="text-sm whitespace-pre-line">{msg.content}</p>

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

                {msg.renders && msg.renders.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {msg.renders.map((r, j) => {
                        const imgUrl = resolveUrl(r.render_url);
                        return imgUrl ? (
                          <div
                            key={j}
                            className="cursor-pointer group relative"
                            onClick={() =>
                              setLightbox({
                                url: imgUrl,
                                roomName: r.room_name,
                              })
                            }
                          >
                            <img
                              src={imgUrl}
                              alt={r.room_name}
                              className="rounded-lg w-full transition-transform group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                              </svg>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 text-center">
                              {r.room_name}
                            </p>
                          </div>
                        ) : null;
                      })}
                    </div>

                    {msg.confirmed ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-400 mt-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Applied to design
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirm(i)}
                        className="mt-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs font-medium rounded-lg transition-colors border border-green-600/30"
                      >
                        Apply changes to design
                      </button>
                    )}
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
                  <span className="text-xs text-gray-500">Updating design...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attached image preview */}
        {attachedPreview && (
          <div className="px-4 pt-2 flex items-center gap-2">
            <div className="relative inline-block">
              <img
                src={attachedPreview}
                alt="Attached"
                className="h-16 rounded-lg border border-gray-700"
              />
              <button
                onClick={clearAttachment}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500"
              >
                &times;
              </button>
            </div>
            <span className="text-xs text-gray-500">Reference image attached</span>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-3">
            {/* Image upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAttachImage}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Attach a reference image"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={
                attachedImage
                  ? 'Describe how to use this item, e.g. "Use this sofa in the living room"'
                  : "Try: 'Change the living room sofa to a dark leather sectional'"
              }
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !attachedImage) || loading}
              className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox for chat images */}
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
          <div
            className="max-w-5xl w-full mx-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.roomName}
              className="max-h-[75vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            <h3 className="text-xl font-bold text-white">
              {lightbox.roomName}
            </h3>
          </div>
        </div>
      )}
    </>
  );
}
