"use client";

import { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal, Menu, Hash, Minus, Square, X, Check, Ban } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
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

function isMentioned(content: string, userId?: string): boolean {
  if (!userId) return false;
  return content.includes(`<@!${userId}>`);
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function ChatPageInner() {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const { setActiveChannel } = useNotifications();
  const searchParams = useSearchParams();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; display_name: string }[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(DefaultIcon);



  // Find `<@!user_id>` and replace all instances of it with a styled user mention box of `@Display Name`
  function parse_msg(text: string, currentUserId?: string): string {
    return text.replace(/<@!([0-9a-f-]+)>/g, (_, userId) => {
      const name = profileCache.current.get(userId) ?? "Unknown";
      const isSelf = userId === currentUserId;
      return `<span class="mention${isSelf ? " mention-self" : ""}">@${name}</span>`;
    });
  }

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
  const activeRef = useRef<string>("");
  const pendingScrollRef = useRef<string | null>(null);
  const mentionMap = useRef<Map<string, string>>(new Map()); // "@Display Name" -> "<@!uuid>"

  const handleReact = async (messageId: string, emoji: string) => {
    if (!token) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, emoji }),
    });
  };

  // Logic to insert emoji at the cursor position
  const onEmojiClick = (emojiData: EmojiClickData) => {
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
    const messageId = searchParams.get("message");
    if (!messageId)
      bottomRef.current?.scrollIntoView({ behavior: "instant" });

    // If we have a pending scroll target and the messages for this
    // channel have just loaded, scroll to it now
    if (pendingScrollRef.current && (messages[active]?.length ?? 0) > 0) {
      const messageId = pendingScrollRef.current;
      pendingScrollRef.current = null;
      setTimeout(() => {
        const el = document.getElementById(`message-${messageId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.classList.add("highlight");
      }, 50); // just enough time for the DOM to paint
    }
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

  useEffect(() => {
    activeRef.current = active;
    setActiveChannel(active);
  }, [active, setActiveChannel]);

  useEffect(() => {
    return () => setActiveChannel(null);
  }, [setActiveChannel]);

  useEffect(() => {
    const channelId = searchParams.get("channel");
    const messageId = searchParams.get("message");
    if (!channelId || channels.length === 0) return;

    // Switch to the right channel
    setActive(channelId);

    if (messageId) {
      pendingScrollRef.current = messageId;
    }

    // Clear params from URL so a refresh doesn't re-trigger this
    router.replace("/chat");
  }, [searchParams, channels]);

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
    if (loading || !token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    })
        .then((r) => { if (!r.ok) return null; return r.json(); })
        .then((data) => { if (Array.isArray(data)) setChannels(data); })
        .finally(() => setLoadingChannels(false));
  }, [token, loading]);

  useEffect(() => {
    if (!token) return;
    supabase.from("profiles").select("id, display_name").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, [token]);

  useEffect(() => {
    if (channels.length > 0 && !active) {
      setActive(channels[0].id);
    }
  }, [channels]);

  useEffect(() => {
    if (!token || !active) return;

    const loadMessages = async () => {
        const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
        );
        const data: DbMessage[] = await r.json();
        if (!Array.isArray(data)) return;

        const mapped: Message[] = await Promise.all(data.map(async (m) => ({
          id: m.id,
          author: m.profiles?.display_name ?? "Unknown",
          authorId: m.user_id,
          content: m.content,
          time: formatTime(m.created_at),
        })));

        setMessages((prev) => ({ ...prev, [active]: mapped }));

        // Resolve any mentions not yet in the cache
        const mentionIds = new Set<string>();
        data.forEach((m) => {
          for (const match of m.content.matchAll(/<@!([0-9a-f-]+)>/g)) {
            if (!profileCache.current.has(match[1])) mentionIds.add(match[1]);
          }
        });

        if (mentionIds.size > 0) {
          await Promise.all([...mentionIds].map(getDisplayName));
          // Re-render now that the cache is populated
          setMessages((prev) => ({ ...prev }));
        }
    };

    loadMessages();

    const channel = supabase
        .channel(`chat-page:${active}`)
        .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${active}` },
            async (payload) => {
              const channelId = active; // capture before any await
              const record = payload.new as Omit<DbMessage, "profiles">;
              const displayName = await getDisplayName(record.user_id);
              setMessages((prev) => ({
                ...prev,
                [channelId]: [...(prev[channelId] ?? []), {
                  id: record.id,
                  author: displayName,
                  authorId: record.user_id,
                  content: record.content,
                  time: formatTime(record.created_at),
                  reactions: [],
                }],
              }));
            }
        )
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${active}` },
            (payload) => {
              const { id, content } = payload.new as { id: string; content: string };
              setMessages((prev) => {
                const list = prev[active] ?? [];
                return { ...prev, [active]: list.map((m) => m.id === id ? { ...m, content } : m) };
              });
            }
        )
        .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${active}` },
            (payload) => {
              const id = (payload.old as { id: string }).id;
              if (!id) return;
              setMessages((prev) => {
                const list = prev[active] ?? [];
                return { ...prev, [active]: list.filter((m) => m.id !== id) };
              });
              setEditingId((prev) => (prev === id ? null : prev));
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [active, token, getDisplayName]);

  async function send() {
    const text = input.trim();
    if (!text || !token)
      return;

    // Convert @Display Name back to <@!uuid>
    let rawText = text;
    mentionMap.current.forEach((raw, display) => {
      rawText = rawText.replaceAll(display, raw);
    });

    setInput("");
    mentionMap.current.clear();
    inputRef.current?.focus();

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/message/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channelId: active, content: rawText }),
    });
  }

  function insertMention(profile: { id: string; display_name: string }) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const textAfterCursor = input.slice(cursor);
    const displayText = `@${profile.display_name}`;
    const replaced = textBeforeCursor.replace(/@([^\s@]*)$/, `${displayText} `);
    mentionMap.current.set(displayText, `<@!${profile.id}>`);
    setInput(replaced + textAfterCursor);
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (mentionResults.length > 0) {
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    let val = e.target.value;

    // Convert any manually typed <@!uuid> to @Display Name
    val = val.replace(/<@!([0-9a-f-]+)>/g, (full, userId) => {
        const profile = profiles.find((p) => p.id === userId);
        if (!profile)
            return full; // leave as-is if not found
        const displayText = `@${profile.display_name}`;
        mentionMap.current.set(displayText, full);
        return displayText;
    });

    setInput(val);

    // Detect @mention autocomplete
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      const results = profiles.filter(
          (p) => fuzzyMatch(query, p.display_name)
      ).slice(0, 5);
      setMentionResults(results);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
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

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, newContent }),
    });
    if (!res.ok) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
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
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages`,
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
      <div className="flex items-center justify-center h-screen w-screen bg-beige dark:bg-darker-blue">
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
          className="w-full flex items-center border-b-2 border-darker-blue/20 dark:border-beige/25 mt-2 pb-2 gap-2 pr-4"
          style={isElectron ? ({ WebkitAppRegion: "drag" } as any) : undefined}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 ml-2 p-1.5 rounded-full hover:bg-darker-blue/10 dark:hover:bg-beige/10 transition-all cursor-pointer"
            style={isElectron ? ({ WebkitAppRegion: "no-drag" } as any) : undefined}
          >
            <Menu size={20} className="text-teal" />
          </button>

          {activeChannel ? (
            <div className="flex items-center min-w-0 ml-2 flex-1">
              <Hash size={20} className="text-teal ml-2" />
              <span className="text-darker-blue dark:text-offwhite font-bold text-lg ml-1 truncate">
                {activeChannel.name}
              </span>
              <span className="text-teal/75 font-medium text-xs ml-5 border-l border-teal/25 pl-4 hidden sm:block truncate">
                {activeChannel.description}
              </span>
            </div>
          ) : (
            <span className="text-darker-blue/40 dark:text-offwhite/40 text-sm ml-2 flex-1">
              {loadingChannels ? "Loading..." : "No channels"}
            </span>
          )}

          {isElectron && !isMac && (
            <div className="flex items-center gap-1 ml-2 shrink-0" style={{ WebkitAppRegion: "no-drag" } as any}>
              <button onClick={() => window.electronAPI?.minimize()} className="p-2 text-darker-blue/50 dark:text-offwhite/50 hover:text-darker-blue dark:hover:text-offwhite"><Minus size={14}/></button>
              <button onClick={() => window.electronAPI?.maximize()} className="p-2 text-darker-blue/50 dark:text-offwhite/50 hover:text-darker-blue dark:hover:text-offwhite"><Square size={12}/></button>
              <button onClick={() => window.electronAPI?.close()} className="p-2 text-darker-blue/50 dark:text-offwhite/50 hover:bg-red hover:text-white"><X size={14}/></button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 w-full overflow-y-auto min-h-0 bg-beige dark:bg-darkest-blue">
          {msgs.length === 0 && !loadingChannels && (
            <p className="text-center text-darker-blue/75 dark:text-offwhite/75 text-sm mt-4">Channel empty.</p>
          )}
          {msgs.map((msg) => (
            <div
                key={msg.id}
                id={`message-${msg.id}`}
                className={`group relative flex flex-col gap-2 w-full px-4 py-2 hover:bg-darker-blue/5 dark:hover:bg-white/5 transition-colors  ${
                  isMentioned(msg.content, user?.id) ? "bg-teal/25 dark:bg-teal/15 border-l-2 border-teal" : ""
                }`}>
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
                <span className="text-sm font-semibold text-darker-blue dark:text-beige truncate flex-1">
                  {msg.author}
                </span>
                <span className="text-xs text-darker-blue/75 dark:text-beige/75 shrink-0">
                  {msg.time}
                </span>
              </div>

              {editingId === msg.id ? (
                <div className="flex flex-col gap-1.5 ml-10">
                  <textarea
                    ref={editRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleEditKey}
                    className="w-full bg-beige dark:bg-dark-blue border border-teal/40 text-darker-blue dark:text-offwhite text-sm rounded-lg px-3 py-2 outline-none resize-none"
                  />
                  <div className="flex items-center gap-2 text-xs text-darker-blue/50 dark:text-beige/50">
                    <button onClick={saveEdit} className="flex items-center gap-1 px-2.5 py-1 rounded bg-teal/15 text-teal hover:bg-teal/25">
                      <Check size={12} />Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-darker-blue/10 dark:hover:bg-beige/10">
                      <Ban size={12} />Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                      className="text-sm text-darker-blue dark:text-offwhite wrap-break-words ml-10"
                      dangerouslySetInnerHTML={{ __html: parse_msg(msg.content, user?.id) }}
                  />
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
              <div className="relative shadow-2xl border border-teal/30 rounded-lg overflow-hidden bg-beige dark:bg-darkest-blue">
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
              {mentionResults.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border-2 border-teal/20 bg-beige dark:bg-dark-blue shadow-xl overflow-hidden z-50">
                    {mentionResults.map((p, i) => (
                        <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                                i === mentionIndex
                                    ? "bg-teal/20 text-teal"
                                    : "text-darker-blue dark:text-offwhite hover:bg-teal/10"
                            }`}
                        >
                          @{p.display_name}
                        </button>
                    ))}
                  </div>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKey}
                placeholder={activeChannel ? `Message #${activeChannel.name}` : ""}
                disabled={!activeChannel}
                rows={1}
                className="flex-1 bg-transparent text-darker-blue dark:text-offwhite placeholder:text-darker-blue/40 dark:placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 pl-5 pr-12 py-2.5 outline-none focus:border-teal/60 transition-colors text-sm resize-none disabled:opacity-40 min-w-0"
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

export default function ChatPage() {
  return (
      <Suspense>
        <ChatPageInner />
      </Suspense>
  );
}
