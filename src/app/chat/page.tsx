"use client";

import { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal, Menu, Hash, Minus, Square, X, Check, Ban } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseClient } from "@/lib/supabase/client";
import MessageHover from "@/components/MessageHover";
import MessageReactions from "@/components/MessageReactions";
import Image from "next/image";
import { EmojiClickData, Theme } from 'emoji-picker-react';

// Lazy load the picker to match your MessageHover pattern
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const DefaultIcon = "/face-grin.png";
const ReactIcons = [
    "/face-frown.png",
    "/face-grin-hearts.png",
    "/face-grin-squint-tears.png",
    "/face-grin-tongue.png",
    "/face-rolling-eyes.png",
    "/face-surprise.png"
];

type Channel = {
  id: string;
  name: string;
  description: string;
};

type DbMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  replies_to: string | null;
  profiles: { display_name: string } | null;
};

export type Reaction = {
  emoji: string;
  count: number;
  users: string[];
};

type Message = {
  id: string;
  author: string;
  authorId: string;
  content: string;
  time: string;
  reactions?: Reaction[];
};

type InsertBroadcastPayload = {
  payload: {
    record: Omit<DbMessage, "profiles">;
  };
};

type UpdateBroadcastPayload = {
  payload: {
    record: { id: string; content: string };
  };
};

type DeleteBroadcastPayload = {
  payload: {
    record?: { id: string } | null;
    old_record?: { id: string } | null;
  };
};

const supabase = createSupabaseClient();

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(DefaultIcon);

  const handleMouseEnter = () => {
        const randomIcon = ReactIcons[Math.floor(Math.random() * ReactIcons.length)];
        setCurrentIcon(randomIcon);
    };

    const handleMouseLeave = () => {
        setCurrentIcon(DefaultIcon);
    };
  
  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Inline message editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Profile cache: userId -> displayName
  const profileCache = useRef<Map<string, string>>(new Map());

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleReact = async (messageId: string, emoji: string) => {
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, emoji }),
    });
  };

  // Logic to insert emoji at the cursor position
  const onEmojiClick = (emojiData:EmojiClickData) => {
    const cursor = inputRef.current?.selectionStart || 0;
    const text = input.slice(0, cursor) + emojiData.emoji + input.slice(cursor);
    setInput(text);
    setShowEmojiPicker(false);
    // Refocus textarea after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      setIsElectron(true);
      setIsMac(window.electronAPI.platform === "darwin");
    }
  }, []);

  useEffect(() => {
    if (!loading && !token) router.replace("/auth");
  }, [token, loading, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setEditingId(null);
        setEditContent("");
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const getDisplayName = useCallback(async (userId: string): Promise<string> => {
    if (profileCache.current.has(userId))
      return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    const name = data?.display_name ?? "Unknown";
    profileCache.current.set(userId, name);
    return name;
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (data.length > 0) setActive(data[0].id);
      })
      .finally(() => setLoadingChannels(false));
  }, [token]);

  useEffect(() => {
    if (!token || !active) return;

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data: DbMessage[]) => {
        if (!Array.isArray(data)) return;
        const mapped: Message[] = data.map((m) => ({
          id: m.id,
          author: m.profiles?.display_name ?? "Unknown",
          authorId: m.user_id,
          content: m.content,
          time: formatTime(m.created_at),
        }));
        setMessages((prev) => ({ ...prev, [active]: mapped }));
      });

    const channel = supabase.channel(`channel:${active}:messages`, {
      config: { private: true },
    });

    channel
      .on(
        "broadcast",
        { event: "INSERT" },
        async ({ payload }: InsertBroadcastPayload) => {
          const record = payload.record;
          const displayName = await getDisplayName(record.user_id);
          const msg: Message = {
            id: record.id,
            author: displayName,
            authorId: record.user_id,
            content: record.content,
            time: formatTime(record.created_at),
          };
          setMessages((prev) => ({
            ...prev,
            [active]: [...(prev[active] ?? []), msg],
          }));
        }
      )
      .on(
        "broadcast",
        { event: "UPDATE" },
        ({ payload }: UpdateBroadcastPayload) => {
          const { id, content } = payload.record;
          setMessages((prev) => {
            const list = prev[active] ?? [];
            return {
              ...prev,
              [active]: list.map((m) =>
                m.id === id ? { ...m, content } : m
              ),
            };
          });
        }
      )
      .on(
        "broadcast",
        { event: "DELETE" },
        ({ payload }: DeleteBroadcastPayload) => {
          const id = payload.old_record?.id ?? payload.record?.id;
          if (!id) return;
          setMessages((prev) => {
            const list = prev[active] ?? [];
            return {
              ...prev,
              [active]: list.filter((m) => m.id !== id),
            };
          });
          setEditingId((prev) => (prev === id ? null : prev));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [active, token, getDisplayName]);

  async function send() {
    const text = input.trim();
    if (!text || !token) return;

    setInput("");
    inputRef.current?.focus();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/message/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channelId: active, content: text }),
    });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function startEdit(messageId: string) {
    const msg = (messages[active] ?? []).find((m) => m.id === messageId);
    if (!msg) return;
    setEditingId(messageId);
    setEditContent(msg.content);
  }

  async function saveEdit() {
    if (!editingId || !editContent.trim() || !token) return;

    const messageId = editingId;
    const newContent = editContent.trim();

    setMessages((prev) => ({
      ...prev,
      [active]: (prev[active] ?? []).map((m) =>
        m.id === messageId ? { ...m, content: newContent } : m
      ),
    }));
    setEditingId(null);
    setEditContent("");

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/messages/edit`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId, newContent }),
      }
    );

    if (!res.ok) {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
        .then((r) => r.json())
        .then((data: DbMessage[]) => {
          if (!Array.isArray(data)) return;
          setMessages((prev) => ({
            ...prev,
            [active]: data.map((m) => ({
              id: m.id,
              author: m.profiles?.display_name ?? "Unknown",
              authorId: m.user_id,
              content: m.content,
              time: formatTime(m.created_at),
            })),
          }));
        });
    }
  }

  function handleEditKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  }

  async function handleDelete(messageId: string) {
    if (!token) return;

    setMessages((prev) => ({
      ...prev,
      [active]: (prev[active] ?? []).filter((m) => m.id !== messageId),
    }));

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/messages/delete`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId }),
      }
    );

    if (!res.ok) {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
        .then((r) => r.json())
        .then((data: DbMessage[]) => {
          if (!Array.isArray(data)) return;
          setMessages((prev) => ({
            ...prev,
            [active]: data.map((m) => ({
              id: m.id,
              author: m.profiles?.display_name ?? "Unknown",
              authorId: m.user_id,
              content: m.content,
              time: formatTime(m.created_at),
            })),
          }));
        });
    }
  }

  const activeChannel = channels.find((c) => c.id === active);
  const msgs = messages[active] ?? [];

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-darker-blue">
        <span className="text-teal/50 text-sm">Loading...</span>
      </div>
    );

  if (!token) return null;

  return (
    <div className="flex flex-row h-screen w-screen fixed top-0">
      <Sidebar
        channels={channels}
        active={active}
        setActive={setActive}
        user={{ displayName: user?.displayName ?? "..." }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col h-screen w-full min-w-0 justify-between items-center">
        {/* Header */}
        <div
          className="w-full flex items-center border-b-2 border-beige/25 mt-2 pb-2 gap-2 pr-4"
          style={isElectron ? ({ WebkitAppRegion: "drag" } as any) : undefined}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 ml-2 p-1.5 rounded-full hover:bg-beige/10 transition-all cursor-pointer"
            style={isElectron ? ({ WebkitAppRegion: "no-drag" } as any) : undefined}
          >
            <Menu size={20} className="text-teal" />
          </button>

          {activeChannel ? (
            <div className="flex items-center min-w-0 ml-2 flex-1">
              <Hash size={20} className="text-teal ml-2" />
              <span className="text-offwhite font-bold text-lg ml-1 truncate">{activeChannel.name}</span>
              <span className="text-teal/75 font-medium text-xs ml-5 border-l border-teal/25 pl-4 hidden sm:block truncate">
                {activeChannel.description}
              </span>
            </div>
          ) : (
            <span className="text-offwhite/40 text-sm ml-2 flex-1">
              {loadingChannels ? "Loading..." : "No channels"}
            </span>
          )}

          {isElectron && !isMac && (
            <div className="flex items-center gap-1 ml-2 shrink-0" style={{ WebkitAppRegion: "no-drag" } as any}>
              <button onClick={() => window.electronAPI?.minimize()} className="p-2 text-offwhite/50 hover:text-offwhite"><Minus size={14}/></button>
              <button onClick={() => window.electronAPI?.maximize()} className="p-2 text-offwhite/50 hover:text-offwhite"><Square size={12}/></button>
              <button onClick={() => window.electronAPI?.close()} className="p-2 text-offwhite/50 hover:bg-red hover:text-white"><X size={14}/></button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 w-full overflow-y-auto min-h-0 bg-darkest-blue">
          {msgs.length === 0 && !loadingChannels && (
            <p className="text-center text-offwhite/75 text-sm mt-4">Channel empty.</p>
          )}
          {msgs.map((msg) => (
            <div key={msg.id} className="group relative flex flex-col gap-2 w-full px-4 py-2 hover:bg-white/5 transition-colors">
              {editingId !== msg.id && (
                <div className="absolute right-4 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <MessageHover
                    messageId={msg.id}
                    authorId={msg.authorId}
                    userId={user?.id ?? ""}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                    onReact={handleReact}
                  />
                </div>
              )}

              <div className="flex flex-row items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center shrink-0">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neon-teal">
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-beige truncate flex-1">{msg.author}</span>
                <span className="text-xs text-beige/75 shrink-0">{msg.time}</span>
              </div>

              {editingId === msg.id ? (
                <div className="flex flex-col gap-1.5 ml-10">
                  <textarea
                    ref={editRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleEditKey}
                    className="w-full bg-dark-blue border border-teal/40 text-offwhite text-sm rounded-lg px-3 py-2 outline-none resize-none"
                  />
                  <div className="flex items-center gap-2 text-xs text-beige/50">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-2.5 py-1 rounded bg-teal/15 text-teal hover:bg-teal/25"><Check size={12}/>Save</button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-beige/10"><Ban size={12}/>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-offwhite wrap-break-words ml-10">{msg.content}</div>
                  <MessageReactions reactions={msg.reactions || []} />
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input & Emoji Picker Area */}
        <div className="flex flex-col w-full px-4 pb-4 pt-2 relative">
          
          {/* Floating Emoji Picker Popup */}
          {showEmojiPicker && (
            <div className="absolute bottom-20 right-4 z-50">
              {/* Backdrop listener to close when clicking outside */}
              <div className="fixed inset-0" onClick={() => setShowEmojiPicker(false)} />
              
              <div className="relative shadow-2xl border border-teal/30 rounded-lg overflow-hidden bg-darkest-blue">
                <Suspense fallback={
                  <div className="w-[350px] h-[400px] flex flex-col items-center justify-center border border-teal/20 rounded-lg">
                    <img src={DefaultIcon} className="w-8 h-8 animate-bounce opacity-50 mb-2" alt="loading" />
                    <span className="text-teal/50 text-xs">Loading Emojis...</span>
                  </div>
                }>
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    theme={"dark" as any}
                    width={350}
                    height={400}
                    lazyLoadEmojis={true}
                  />
                </Suspense>
              </div>
            </div>
          )}

          <div className="flex flex-row items-center gap-2 w-full">
            <div className="relative flex-1 flex items-center">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={activeChannel ? `Message #${activeChannel.name}` : ""}
                disabled={!activeChannel}
                rows={1}
                className="flex-1 bg-transparent text-offwhite placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 pl-5 pr-12 py-2.5 outline-none focus:border-teal/60 transition-colors text-sm resize-none disabled:opacity-40 min-w-0"
              />
              
              {/* Custom Image Emoji Trigger */}
              <button
                type="button"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={!activeChannel}
                className="absolute right-4 p-1 hover:scale-110 active:scale-95 transition-all disabled:opacity-0 disabled:pointer-events-none"
              >
                <Image 
                  src={currentIcon} 
                  alt="emoji picker" 
                  width={24}
                  height={24}
                  className={`object-contain transition-all duration-150 transform hover:scale-110 ${
                    showEmojiPicker ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                  }`} 
                />
              </button>
            </div>

            <button
              onClick={send}
              disabled={!input.trim() || !activeChannel}
              className="shrink-0 w-11 h-11 rounded-full bg-teal flex items-center justify-center hover:brightness-90 transition-all disabled:opacity-40"
            >
              <SendHorizonal className="text-darker-blue" size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}