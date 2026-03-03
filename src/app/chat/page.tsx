"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createSupabaseClient } from "@/lib/supabase/client";

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

type Message = {
  id: string;
  author: string;
  content: string;
  time: string;
};

type BroadcastPayload = {
  payload: {
    record: Omit<DbMessage, "profiles">;
  };
};

const supabase = createSupabaseClient();

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);

  // Profile cache: userId -> displayName
  const profileCache = useRef<Map<string, string>>(new Map());

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Redirect to auth if not logged in (only if auth state is loaded)
  useEffect(() => {
    if (!loading && !token) router.replace("/auth");
  }, [token, loading, router]);

  // Scroll to bottom on new messages or channel switch
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);

  // Fetch a display name, using cache to avoid redundant requests
  const getDisplayName = useCallback(async (userId: string): Promise<string> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();
    const name = data?.display_name ?? "Unknown";
    profileCache.current.set(userId, name);
    return name;
  }, []);

  // Fetch channels from DB on mount
  useEffect(() => {
    if (!token) return;
    fetch("/api/channels", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Channel[]) => {
        setChannels(data);
        if (data.length > 0) setActive(data[0].id);
      })
      .finally(() => setLoadingChannels(false));
  }, [token]);

  // Fetch history & subscribe to realtime on channel switch
  useEffect(() => {
    if (!token || !active)
      return;

    // Fetch msg history
    fetch(`/api/channel/${active}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: DbMessage[]) => {
        if (!Array.isArray(data)) {
          console.error("Failed to load messages:", data);
          return;
        }
        const mapped: Message[] = data.map((m) => ({
          id: m.id,
          author: m.profiles?.display_name ?? "Unknown",
          content: m.content,
          time: formatTime(m.created_at),
        }));
        setMessages((prev) => ({ ...prev, [active]: mapped }));
      });

    // Realtime subscription \\ Note: don't get supabase.channel confused with chat channels.
    const channel = supabase.channel(`channel:${active}:messages`, {
      config: { private: true },
    });

    channel
      .on("broadcast", { event: "INSERT" }, async ({ payload }: BroadcastPayload) => {
        const record = payload.record;
        const displayName = await getDisplayName(record.user_id);
        const msg: Message = {
          id: record.id,
          author: displayName,
          content: record.content,
          time: formatTime(record.created_at),
        };
        setMessages((prev) => ({
          ...prev,
          [active]: [...(prev[active] ?? []), msg],
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [active, token, getDisplayName]);

  async function send() {
    const text = input.trim();
    if (!text || !token)
      return;

    setInput("");
    inputRef.current?.focus();

    await fetch("/api/message/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channelId: active, content: text }),
    });
    // No optimistic update needed. Realtime broadcast will deliver it back
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const activeChannel = channels.find((c) => c.id === active);
  const msgs = messages[active] ?? [];

  // Show a blank screen while session is being restored
  if (loading)
    return (
    <div className="flex items-center justify-center h-screen w-screen bg-darker-blue">
      <span className="text-teal/50 text-sm">Loading...</span>
    </div>
  );

  if (!token)
    return null; // Redirecting

  return (
    <div className="flex flex-row justify-between h-screen w-screen gap-2 py-0 my-0 fixed top-0">
      <Sidebar
        channels={channels}
        active={active}
        setActive={setActive}
        user={{ displayName: user?.displayName ?? "..." }}
      />

      <div className="flex flex-col h-screen w-full justify-between items-center">
        <div className="w-full h-10 border-b-2 border-beige/25 mt-2 pb-2">
          {activeChannel ? (
            <>
          <span className="text-teal font-black text-xl ml-4">#</span>
          {" "}
              <span className="text-offwhite font-bold text-lg">{activeChannel.name}</span>
          <span className="text-teal/75 font-medium text-xs ml-5 border-l border-teal/25 pl-4">
                {activeChannel.description}
              </span>
            </>
          ) : (
            <span className="text-offwhite/40 text-sm ml-4">
              {loadingChannels ? "Loading..." : "No channels"}
          </span>
          )}
        </div>

        <div className="flex-1 w-full overflow-y-auto min-h-0">
          {msgs.length === 0 && !loadingChannels && (
            <p className="text-center text-offwhite/75 text-sm mt-4">
            Channel empty. Be the first to say something!
            </p>
          )}
          {msgs.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-2 w-full px-4 py-2">
              <div className="flex flex-row items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neon-teal">
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-darker-blue dark:text-beige truncate flex-1">
                  {msg.author}
                </span>
                <span className="text-xs text-darker-blue/75 dark:text-beige/75">
                  {msg.time}
                </span>
              </div>
              <div className="flex flex-row items-center gap-2">
                <div className="text-sm text-offwhite">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-row items-center gap-2 w-full px-4 pb-4 pt-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={activeChannel ? `Message #${activeChannel.name}` : ""}
            disabled={!activeChannel}
            rows={1}
            className="flex-1 bg-transparent text-offwhite placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 px-5 py-2.5 outline-none focus:border-teal/60 transition-colors text-sm resize-none disabled:opacity-40"
          />
          <button
            onClick={send}
            disabled={!input.trim() || !activeChannel}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-teal flex items-center justify-center hover:brightness-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendHorizonal className="text-darker-blue" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
