"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, Suspense, lazy, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal, Menu, Hash, Minus, Square, X, Check, Ban, Reply } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { createSupabaseClient } from "@/lib/supabase/client";
import MessageHover from "@/components/MessageHover";
import MessageReactions from "@/components/MessageReactions";
import Image from "next/image";
import { EmojiClickData, Theme } from 'emoji-picker-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { marked, Renderer } from "marked";
import DOMPurify from "dompurify";

// Code block syntax highlihging | NOTE: must specifiy a language when usitilzing feature, i.e. "```py" or "```python"
const renderer = new Renderer();
renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="hljs-pre"><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.setOptions({ renderer });

// Lazy load the picker to match your MessageHover pattern
const EmojiPicker = lazy(() => import('emoji-picker-react'));

const INITIAL_MSG_COUNT = 50;
const MSGS_TO_LOAD = 25;
const URL_REGEX = /(?<!\]\()https?:\/\/[^\s<>"]+/g;
const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

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
  createdAt: string;
  reactions?: Reaction[];
  repliesTo?: string | null;
  replyToAuthor?: string;
  replyToContent?: string;
  platform?: string;
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

/** Escapes characters that have special meaning in HTML.
 *  Must be applied to any user-controlled string that is embedded inside an
 *  HTML attribute or text node that will be injected into the DOM *after*
 *  DOMPurify has already run (e.g. mention spans restored post-sanitization).
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractUrls(content: string): string[] {
  return [...content.matchAll(URL_REGEX)].map(m => m[0]);
}

function classifyUrl(url: string): "image" | "video" | "link" {
  if (IMAGE_EXTS.test(url))
    return "image";
  if (VIDEO_EXTS.test(url))
    return "video";

  return "link";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (msgDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  }
  if (msgDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  }
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = String(date.getFullYear()).slice(-2);
  return `${m}/${d}/${y} at ${timeStr}`;
}

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateSeparator(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
}

// TODO: ensure user sending the message has permission to ping @everyone, else ignore the @everyone
function isMentioned(content: string, userId?: string): boolean {
  return content.includes("@everyone") || (!!userId && content.includes(`<@!${userId}>`));
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

function parseDiscordBridgeMessage(userId: string, content: string, displayName: string): {
  author: string;
  content: string;
  platform?: string;
} {
  const DISCORD_BRIDGE_USER_ID = "35c4a103-d94e-4677-a34f-628eb8b2a241";

  if (userId !== DISCORD_BRIDGE_USER_ID) {
    return {author: displayName, content};
  }

  const lines = content.split('\n');
  const firstLine = lines[0];

  if (firstLine && firstLine.startsWith("**[Discord] ") && firstLine.endsWith(":")) {
    const username = firstLine.slice(12, -3).trim();
    const remainingContent = lines.slice(1).join('\n');
    return {
      author: username,
      content: remainingContent,
      platform: "Discord"
    };
  }

  return {author: displayName, content};
}

function EmbedComponent({ url }: { url: string }) {
  const linkClassification = classifyUrl(url);
  const [metadata, setMetadata] = useState<{
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkClassification === "link") {
      setLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/og?url=${encodeURIComponent(url)}`)
          .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setMetadata(data); })
        .catch(() => {})
          .finally(() => setLoading(false));
    }
  }, [url, linkClassification]);

  switch (linkClassification) {
    case "image":
      return <img src={url} alt="Image" className="max-w-sm max-h-64 rounded-lg ml-10 mt-1 object-contain" />;

    case "video":
      return (
          <video controls className="max-w-sm max-h-64 rounded-lg ml-10 mt-1">
            <source src={url}/>
          </video>
      );

    default:
      if (loading) {
        return (
            <div className="max-w-md ml-10 mt-1 p-3 rounded-lg border border-teal/20 bg-beige/30 dark:bg-dark-blue/30 animate-pulse">
              <div className="h-4 bg-teal/20 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-teal/10 rounded w-full"></div>
            </div>
        );
      }

      if (metadata) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-md ml-10 mt-1 p-3 rounded-lg border border-teal/30 bg-beige/50 dark:bg-dark-blue/50 hover:bg-beige/70 dark:hover:bg-dark-blue/70 transition-colors group"
            >
              {metadata.image && (
                  <img
                      src={metadata.image}
                      alt={metadata.title || "Link preview"}
                      className="w-full h-full object-cover rounded mb-2"
                  />
              )}
              {metadata.title && (
                  <div
                      className="font-semibold text-sm text-darker-blue dark:text-offwhite mb-1 group-hover:text-teal dark:group-hover:text-teal transition-colors">
                    {metadata.title}
                  </div>
              )}
              {metadata.description && (
                  <div className="text-xs text-darker-blue/70 dark:text-offwhite/70 mb-1 line-clamp-3">
                    {metadata.description}
                  </div>
              )}
              {metadata.siteName && (
                  <div className="text-xs text-teal/60">
                    {metadata.siteName}
                  </div>
              )}
            </a>
        );
      }

      return (
          <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue dark:text-teal hover:underline break-all"
          >
            {url}
          </a>
      );
  }
}

function MessageEmbeds({ content }: { content: string }) {
  const urls = extractUrls(content);
  return urls.map((url, i) => (
    <div key={`${i}-${url}`} className="mt-2">
      <EmbedComponent url={url}/>
    </div>
  ));
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
  const [showPreview, setShowPreview] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; display_name: string }[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [isElectron, setIsElectron] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [currentIcon, setCurrentIcon] = useState(DefaultIcon);
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  function startReply(messageId: string) {
    const msg = (messages[active] ?? []).find((m) => m.id === messageId);
    if (msg)
      setReplyingTo(msg);
    inputRef.current?.focus();
  }

  // Find `<@!user_id>` or `@everyone` and replace all instances of it with a styled user mention box of `@Display Name` or `@everyone`
  function parse_msg(text: string, currentUserId?: string): string {
  // 1. Replace mentions with placeholders so marked doesn't escape the < > characters
  const mentionSpans: string[] = [];
  const protected_text = text
    .replace(/@everyone/g, () => {
      mentionSpans.push(`<span class="mention mention-self">@everyone</span>`);
      return `%%MENTION_${mentionSpans.length - 1}%%`;
    })
        .replace(/<@!([0-9a-f-]+)>/g, (_, userId) => {
          // escapeHtml is required here: mention spans are re-injected into the
          // DOM *after* DOMPurify runs, so any HTML in the display name would
          // bypass sanitization entirely without this step.
          const name = escapeHtml(profileCache.current.get(userId) ?? "Unknown");
          const isSelf = userId === currentUserId;
      mentionSpans.push(`<span class="mention${isSelf ? " mention-self" : ""}">@${name}</span>`);
      return `%%MENTION_${mentionSpans.length - 1}%%`;
        });

  // 2. Run markdown (mentions are now plain tokens, safe from escaping)
  //
  // Escape '<' before handing the text to marked. Every HTML tag starts with '<',
  // so this prevents raw HTML injection at the source — marked never sees a tag
  // to pass through. Common markdown syntax (**bold**, *em*, > blockquote, etc.)
  // does not use '<', so nothing is lost. The only intentional trade-off is GFM
  // autolinks (<https://example.com>) which are disabled, acceptable for chat.
  //
  // Note: renderer.html / the 'html' token hook is NOT sufficient on its own
  // because it only fires for block-level HTML tokens. Inline tags like <strong>
  // and <em> are lexed as Tag tokens through the inline renderer path and bypass
  // that hook entirely.
  // Build the text that will be handed to marked with raw HTML neutralised.
  //
  // We must NOT touch '<' inside code spans/blocks: marked escapes their content
  // itself, so a '<' we pre-escape becomes '&amp;lt;' in the final HTML and the
  // browser shows the literal string "&lt;" instead of "<".
  //
  // Order of operations:
  //   1. Stash \< escape sequences — restore later so marked renders them as <.
  //   2. Stash fenced code blocks (``` / ~~~) and inline code (`…`) verbatim.
  //   3. Escape every remaining '<' — these are raw HTML injection attempts.
  //   4. Restore \< so marked can process the escape.
  //   5. Restore code blocks/spans with their original '<' characters intact.
  const codeStash: string[] = [];
  const noHtmlText = protected_text
    // 1. protect \<
    .replace(/\\</g, "%%ESC_LT%%")
    // 2. stash fenced blocks (``` or ~~~, non-greedy) then inline code spans
    .replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g, (match) => {
      codeStash.push(match);
      return `%%CODE_${codeStash.length - 1}%%`;
    })
    // 3. escape '&' so user-typed entities like &lt; or &amp; display as literal
    //    text instead of being interpreted by the browser. Runs after the code
    //    stash (marked escapes & inside code itself) and before step 4 (otherwise
    //    the &lt; we insert there would be double-escaped to &amp;lt;).
    .replace(/&/g, "&amp;")
    // 4. block raw HTML
    .replace(/</g, "&lt;")
    // 5. restore \< for marked
    .replace(/%%ESC_LT%%/g, "\\<")
    // 6. restore code blocks/spans untouched
    .replace(/%%CODE_(\d+)%%/g, (_, i) => codeStash[parseInt(i)]);

  const rawHtml = marked.parse(noHtmlText, { breaks: true, gfm: true }) as string;

  // Always sanitize — defense-in-depth against anything the renderer misses.
  // No typeof window guard: this is a "use client" component so window is always
  // defined at render time, and dropping the guard prevents the sanitizer from
  // being silently skipped if this logic is ever reused elsewhere.
  const cleanHtml = DOMPurify.sanitize(rawHtml);

  // 3. Restore mention spans
  return cleanHtml.replace(/%%MENTION_(\d+)%%/g, (_, i) => mentionSpans[parseInt(i)]);
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

  // Message options menu state
  const [pinnedMenuId, setPinnedMenuId] = useState<string | null>(null);

  // Inline message editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Profile cache: userId -> displayName
  const profileCache = useRef<Map<string, string>>(new Map());

  const initialScrollDoneRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef<string>("");
  const pendingScrollRef = useRef<string | null>(null);
  const mentionMap = useRef<Map<string, string>>(new Map()); // "@Display Name" -> "<@!uuid>"
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);
  const justPrependedRef = useRef(false);
  const prevActiveRef = useRef<string>("");
  const scrollHeightBeforeRef = useRef(0);
  const scrollTopBeforeRef = useRef(0);

  const userRef = useRef(user);

  const handleReact = async (messageId: string, emoji: string) => {
  if (!token || !user) return;

  const msg = (messages[active] ?? []).find((m) => m.id === messageId);
  const alreadyReacted = msg?.reactions?.find((r) => r.emoji === emoji)?.users.includes(user.id) ?? false;

  // Optimistic update
  setMessages((prev) => {
    const list = prev[activeRef.current] ?? [];
    return {
      ...prev,
      [activeRef.current]: list.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions ?? [])];
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (alreadyReacted) {
          if (idx >= 0) {
            const updated = { ...reactions[idx], count: reactions[idx].count - 1, users: reactions[idx].users.filter((u) => u !== user.id) };
            updated.count <= 0 ? reactions.splice(idx, 1) : (reactions[idx] = updated);
          }
        } else {
          idx >= 0
            ? (reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, users: [...reactions[idx].users, user.id] })
            : reactions.push({ emoji, count: 1, users: [user.id] });
        }
        return { ...m, reactions };
      }),
    };
  });

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId, emoji }),
    });
  };

  const handleSetActive = (id: string) => {
    setReplyingTo(null);
    setActive(id);
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

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // If the click isn't inside a message context menu, unpin
      if (!(e.target as Element).closest("[data-message-hover]")) {
        setPinnedMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const messageId = searchParams.get("message");
    const isChannelSwitch = prevActiveRef.current !== active;
    prevActiveRef.current = active;

    // On initial load for a channel, scroll to bottom once messages arrive
    if (!initialScrollDoneRef.current.has(active) && (messages[active]?.length ?? 0) > 0) {
      initialScrollDoneRef.current.add(active);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 0);
      return;
    }

    // Never interfere when we just prepended older messages. The
    // useLayoutEffect above already restored the exact scroll position.
    if (justPrependedRef.current) {
      justPrependedRef.current = false;
      return;
    }

    if (pendingScrollRef.current && (messages[active]?.length ?? 0) > 0) {
      const targetId = pendingScrollRef.current;
      pendingScrollRef.current = null;
      setTimeout(() => {
        const el = document.getElementById(`message-${targetId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.classList.add("highlight");
      }, 50); // just enough time for the DOM to paint
      return;
    }

    if (messageId)
        return;

    // On a channel switch always go to the bottom.
    // For realtime updates only scroll if the user is already near the bottom
    // so reading history isn't interrupted.
    const container = scrollContainerRef.current;
    const isNearBottom = !container ||
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    if (isChannelSwitch || isNearBottom)
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
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
    handleSetActive(channelId);

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
      handleSetActive(channels[0].id);
    }
  }, [channels]);

  function applyReactionInsert(
      prev: Record<string, Message[]>,
      message_id: string, user_id: string, emoji: string
  ): Record<string, Message[]> {
    const list = prev[activeRef.current] ?? [];
    if (!list.some((m) => m.id === message_id)) return prev;
    return {
      ...prev,
      [activeRef.current]: list.map((m) => {
        if (m.id !== message_id) return m;
        const reactions = [...(m.reactions ?? [])];
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const r = reactions[idx];
          reactions[idx] = { ...r, count: r.count + 1, users: [...r.users, user_id] };
        } else {
          reactions.push({ emoji, count: 1, users: [user_id] });
        }
        return { ...m, reactions };
      }),
    };
  }

  function applyReactionDelete(
      prev: Record<string, Message[]>,
      message_id: string, user_id: string, emoji: string
  ): Record<string, Message[]> {
    const list = prev[activeRef.current] ?? [];
    if (!list.some((m) => m.id === message_id)) return prev;
    return {
      ...prev,
      [activeRef.current]: list.map((m) => {
        if (m.id !== message_id) return m;
        const reactions = (m.reactions ?? [])
            .map((r) => r.emoji === emoji
                ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== user_id) }
                : r
            )
            .filter((r) => r.count > 0);
        return { ...m, reactions };
      }),
    };
  }

  useEffect(() => {
    if (!token || !active) return;

    const loadMessages = async () => {
        const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages?count=${INITIAL_MSG_COUNT}`,
      { headers: { Authorization: `Bearer ${token}` } }
        );
        const data: DbMessage[] = await r.json();
        if (!Array.isArray(data)) return;

      const mapped: Message[] = await Promise.all(data.map(async (m) => {
        const parsed = parseDiscordBridgeMessage(
            m.user_id,
            m.content,
            m.profiles?.display_name ?? "Unknown"
        );
        return {
          id: m.id,
          author: parsed.author,
          authorId: m.user_id,
          content: parsed.content,
          time: formatTimestamp(m.created_at),
          createdAt: m.created_at,
          repliesTo: m.replies_to,
          platform: parsed.platform,
        };
      }));
      const msgById = new Map(mapped.map((m) => [m.id, m]));

      // First pass: resolve from the current batch
      let resolved = mapped.map((m) => {
        if (!m.repliesTo) return m;
        const parent = msgById.get(m.repliesTo);
        return parent
            ? {...m, replyToAuthor: parent.author, replyToContent: parent.content}
            : m;
      });

      // Second pass: fetch any parents not in the batch
      const missingIds = [...new Set(
          resolved
              .filter((m) => m.repliesTo && !m.replyToAuthor)
              .map((m) => m.repliesTo!)
      )];

      if (missingIds.length > 0) {
        const {data: parentRows} = await supabase
            .from("messages")
            .select("id, content, user_id, profiles(display_name)")
            .in("id", missingIds);

        if (parentRows) {
          const parentMap = new Map(
              parentRows.map((p: any) => [p.id, {
                author: p.profiles?.display_name ?? "Unknown",
                content: p.content,
              }])
          );
          resolved = resolved.map((m) =>
              m.repliesTo && !m.replyToAuthor && parentMap.has(m.repliesTo)
                  ? {
                    ...m, ...parentMap.get(m.repliesTo) && {
                      replyToAuthor: parentMap.get(m.repliesTo)!.author,
                      replyToContent: parentMap.get(m.repliesTo)!.content,
                    }
                  }
                  : m
          );
        }
      }

      setMessages((prev) => ({...prev, [active]: resolved}));

      const messageIds = data.map((m) => m.id);
      if (messageIds.length > 0) {
        const { data: reactionRows } = await supabase
            .from("message_reactions")
            .select("message_id, user_id, emoji")
            .in("message_id", messageIds);

        if (reactionRows) {
          // Group by message_id then emoji
          const reactionMap = new Map<string, Reaction[]>();
          for (const row of reactionRows) {
            const list = reactionMap.get(row.message_id) ?? [];
            const idx = list.findIndex((r) => r.emoji === row.emoji);
            if (idx >= 0) {
              list[idx].count++;
              list[idx].users.push(row.user_id);
            } else {
              list.push({ emoji: row.emoji, count: 1, users: [row.user_id] });
            }
            reactionMap.set(row.message_id, list);
          }
          setMessages((prev) => ({
            ...prev,
            [active]: (prev[active] ?? []).map((m) => ({
              ...m,
              reactions: reactionMap.get(m.id) ?? [],
            })),
          }));
        }
      }

        setHasMoreMessages((prev) => ({ ...prev, [active]: data.length >= INITIAL_MSG_COUNT }));

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
              const parsed = parseDiscordBridgeMessage(
                  record.user_id,
                  record.content,
                  displayName
              );
              setMessages((prev) => {
                const parent = record.replies_to
                  ? (prev[channelId] ?? []).find((m) => m.id === record.replies_to)
                  : undefined;
                return {
                ...prev,
                [channelId]: [...(prev[channelId] ?? []), {
                  id: record.id,
                  author: parsed.author,
                  authorId: record.user_id,
                  content: parsed.content,
                  time: formatTimestamp(record.created_at),
                  createdAt: record.created_at,
                  reactions: [],
                  platform: parsed.platform,
                  repliesTo: record.replies_to ?? null,
                  replyToAuthor: parent?.author,
                  replyToContent: parent?.content,
                }],
              };
            });

              // Resolve any mention IDs not yet in the cache
              const mentionIds = [...record.content.matchAll(/<@!([0-9a-f-]+)>/g)]
                  .map((m) => m[1])
                  .filter((id) => !profileCache.current.has(id));

              if (mentionIds.length > 0) {
                  await Promise.all(mentionIds.map(getDisplayName));
                  setMessages((prev) => ({ ...prev }));
              }
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
              setReplyingTo((prev) => (prev?.id === id ? null : prev));
            }
        )
        .on(
            "postgres_changes",
            {event: "INSERT", schema: "public", table: "message_reactions"},
            (payload) => {
              const {message_id, user_id, emoji} = payload.new as {
                message_id: string; user_id: string; emoji: string;
              };

              // Skip if this is our own reaction — optimistic update already applied it
              if (user_id === userRef.current?.id) {
                setMessages((prev) => {
                  const list = prev[activeRef.current] ?? [];
                  const msg = list.find((m) => m.id === message_id);
                  const alreadyInState = msg?.reactions?.find((r) => r.emoji === emoji)?.users.includes(user_id);
                  if (alreadyInState) return prev; // optimistic update handled it, ignore broadcast
                  // Not in state yet (e.g. reacted from another tab/device), fall through and apply
                  return applyReactionInsert(prev, message_id, user_id, emoji);
                });
                return;
              }

              setMessages((prev) => applyReactionInsert(prev, message_id, user_id, emoji));
            }
        )
        .on(
            "postgres_changes",
            { event: "DELETE", schema: "public", table: "message_reactions" },
            (payload) => {
              const { message_id, user_id, emoji } = payload.old as {
                message_id: string; user_id: string; emoji: string;
              };

              // Skip if this is our own reaction — optimistic update already removed it
              if (user_id === userRef.current?.id) {
                setMessages((prev) => {
                  const list = prev[activeRef.current] ?? [];
                  const msg = list.find((m) => m.id === message_id);
                  const stillInState = msg?.reactions?.find((r) => r.emoji === emoji)?.users.includes(user_id);
                  if (!stillInState) return prev; // optimistic update already removed it
                  // Still in state (e.g. removed from another tab/device), apply removal
                  return applyReactionDelete(prev, message_id, user_id, emoji);
                });
                return;
              }

              setMessages((prev) => applyReactionDelete(prev, message_id, user_id, emoji));
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [active, token, getDisplayName]);

  const loadMoreMessages = useCallback(async () => {
    if (!token || !active || loadingMore || !hasMoreMessages[active]) return;
    const oldest = messages[active]?.[0]?.id;
    if (!oldest) return;

    const container = scrollContainerRef.current;
    if (container) {
      scrollHeightBeforeRef.current = container.scrollHeight;
      scrollTopBeforeRef.current = container.scrollTop;
      isPrependingRef.current = true;
    }

    setLoadingMore(true);
    const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/channel/${active}/messages?before=${oldest}&count=${MSGS_TO_LOAD}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data: DbMessage[] = await r.json();

    if (!Array.isArray(data) || data.length === 0) {
      setHasMoreMessages((prev) => ({ ...prev, [active]: false }));
      setLoadingMore(false);
      isPrependingRef.current = false;
      return;
    }

    const mapped: Message[] = data.map((m) => ({
      id: m.id,
      author: m.profiles?.display_name ?? "Unknown",
      authorId: m.user_id,
      content: m.content,
      time: formatTimestamp(m.created_at),
      createdAt: m.created_at,
      repliesTo: m.replies_to,
    }));

    const msgById = new Map(mapped.map((m) => [m.id, m]));

    // First pass: resolve from the current batch
    let resolved = mapped.map((m) => {
      if (!m.repliesTo) return m;
      const parent = msgById.get(m.repliesTo);
      return parent
          ? { ...m, replyToAuthor: parent.author, replyToContent: parent.content }
          : m;
    });

    // Second pass: fetch any parents not in the batch
    const missingIds = [...new Set(
        resolved
            .filter((m) => m.repliesTo && !m.replyToAuthor)
            .map((m) => m.repliesTo!)
    )];

    if (missingIds.length > 0) {
      const { data: parentRows } = await supabase
          .from("messages")
          .select("id, content, user_id, profiles(display_name)")
          .in("id", missingIds);

      if (parentRows) {
        const parentMap = new Map(
            parentRows.map((p: any) => [p.id, {
              author: p.profiles?.display_name ?? "Unknown",
              content: p.content,
            }])
        );
        resolved = resolved.map((m) =>
            m.repliesTo && !m.replyToAuthor && parentMap.has(m.repliesTo)
                ? { ...m, ...parentMap.get(m.repliesTo) && {
                    replyToAuthor: parentMap.get(m.repliesTo)!.author,
                    replyToContent: parentMap.get(m.repliesTo)!.content,
                  }}
                : m
        );
      }
    }

    justPrependedRef.current = true;
    setMessages((prev) => ({ ...prev, [active]: resolved }));

    if (data.length < MSGS_TO_LOAD)
      setHasMoreMessages((prev) => ({ ...prev, [active]: false }));

    setLoadingMore(false);
  }, [token, active, loadingMore, hasMoreMessages, messages]);

  // Restore scroll position after prepending older messages so the view doesn't jump
  useLayoutEffect(() => {
    if (!isPrependingRef.current) return;
    isPrependingRef.current = false;
    const container = scrollContainerRef.current;
    if (!container) return;
    const diff = container.scrollHeight - scrollHeightBeforeRef.current;
    container.scrollTop = scrollTopBeforeRef.current + diff;
  }, [messages]);

  // IntersectionObserver: trigger load when the top sentinel becomes visible
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;
    if (hasMoreMessages[active] === false) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreMessages();
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, loadMoreMessages, hasMoreMessages]);

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
      body: JSON.stringify({ channelId: active, content: rawText, repliesTo: replyingTo?.id ?? null, }),
    });

    setReplyingTo(null);
  }

  function insertMention(profile: { id: string; display_name: string }) {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const textAfterCursor = input.slice(cursor);

    let displayText: string;
    if (profile.id === "everyone") {
      displayText = "@everyone";
    } else {
      displayText = `@${profile.display_name}`;
      mentionMap.current.set(displayText, `<@!${profile.id}>`);
    }

    const replaced = textBeforeCursor.replace(/@([^\s@]*)$/, `${displayText} `);
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
      const everyone = { id: "everyone", display_name: "everyone" };
      const results = [
        ...(fuzzyMatch(query, "everyone") ? [everyone] : []),
        ...profiles.filter((p) => fuzzyMatch(query, p.display_name)),
      ].slice(0, 5);
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
              time: formatTimestamp(m.created_at),
              createdAt: m.created_at,
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
              time: formatTimestamp(m.created_at),
              createdAt: m.created_at,
            })),
          }));
        });
    }
  }

  const activeChannel = channels.find((c) => c.id === active);

  const markdownPreview = useMemo(() => {
    if (!input.trim()) return "";
    return parse_msg(input, user?.id);
  }, [input, user?.id, profiles]);
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
        setActive={handleSetActive}
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
        <div ref={scrollContainerRef} className="flex-1 w-full overflow-y-auto min-h-0 bg-beige dark:bg-darkest-blue">
          {/* Top sentinel — triggers loading older messages when scrolled into view */}
          <div ref={topSentinelRef} className="h-px w-full" />
          {loadingMore && (
            <div className="flex justify-center py-2">
              <span className="text-teal/50 text-xs animate-pulse">Loading older messages...</span>
            </div>
          )}
          {hasMoreMessages[active] === false && msgs.length > 0 && (
            <p className="text-center text-darker-blue/30 dark:text-offwhite/30 text-xs py-2">
              Beginning of channel history
            </p>
          )}
          {msgs.length === 0 && !loadingChannels && (
            <p className="text-center text-darker-blue/75 dark:text-offwhite/75 text-sm mt-4">Channel empty.</p>
          )}
          {(() => {
            const items: React.ReactNode[] = [];
            let lastDateKey = "";
            msgs.forEach((msg) => {
              const dateKey = getLocalDateKey(msg.createdAt);
              if (dateKey !== lastDateKey) {
                lastDateKey = dateKey;
                items.push(
                  <div key={`sep-${dateKey}`} className="flex items-center gap-3 px-4 py-2 select-none">
                    <div className="flex-1 h-px bg-darker-blue/20 dark:bg-beige/20" />
                    <span className="text-xs font-semibold text-darker-blue/40 dark:text-beige/40 shrink-0">
                      {formatDateSeparator(dateKey)}
                    </span>
                    <div className="flex-1 h-px bg-darker-blue/20 dark:bg-beige/20" />
                  </div>
                );
              }
              items.push(
            <div
                key={msg.id}
                id={`message-${msg.id}`}
                className={`group relative flex flex-col gap-2 w-full px-4 py-2 hover:bg-darker-blue/5 dark:hover:bg-white/5 transition-colors  ${
                  isMentioned(msg.content, user?.id) ? "bg-teal/25 dark:bg-teal/15 border-l-2 border-teal" : ""
                }`}>
              {editingId !== msg.id && (
              <div
                  data-message-hover
                  className={`absolute right-4 top-2 transition-opacity z-20 ${
                      pinnedMenuId === msg.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                  }`}
              >
                  <MessageHover
                    messageId={msg.id}
                    authorId={msg.authorId}
                    userId={user?.id ?? ""}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                    onReact={handleReact}
                    onReply={startReply}
                    onMenuOpen={() => setPinnedMenuId(msg.id)}
                    onMenuClose={() => setPinnedMenuId(null)}
                  />
                </div>
              )}

              {msg.repliesTo && (
                  <button
                      className="flex items-center gap-1.5 ml-10 text-xs text-muted-blue/75 dark:text-beige/50 hover:text-blue dark:hover:text-teal transition-colors mb-0.5"
                      onClick={() => {
                        document.getElementById(`message-${msg.repliesTo}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                  >
                    <Reply size={12} />
                    <span className="font-semibold">@{msg.replyToAuthor ? msg.replyToAuthor.replace(" ", " ") : "Unknown"}</span>
                    <span className="truncate max-w-lg opacity-70">{msg.replyToContent ?? ""}</span>
                  </button>
              )}

              <div className="flex flex-row items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neon-teal">
                    <circle cx="12" cy="8" r="4" fill="currentColor"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor"/>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-darker-blue dark:text-beige truncate">
                  {msg.author}
                </span>
                {msg.platform && (
                    <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-teal/20 text-teal border border-teal/40 shrink-0">
                    {msg.platform}
                  </span>
                )}
                <span className="text-xs text-darker-blue/75 dark:text-beige/75 shrink-0 ml-auto">
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
                    className="w-full bg-beige dark:bg-dark-blue border border-teal/40 text-darker-blue dark:text-offwhite text-sm rounded-lg px-3 py-2 outline-none resize-none message-content"
                  />
                  {editContent.trim() && (
                      <div className="p-2 border border-teal/20 rounded bg-beige/30 dark:bg-dark-blue/30 mt-1 max-h-24 overflow-y-auto">
                        <div
                            className="text-darker-blue/70 dark:text-offwhite/70 message-content"
                            dangerouslySetInnerHTML={{ __html: parse_msg(editContent, user?.id) }}
                        />
                      </div>
                  )}
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
                      className="text-darker-blue dark:text-offwhite wrap-break-word ml-10 message-content"
                      dangerouslySetInnerHTML={{ __html: parse_msg(msg.content, user?.id) }}
                  />
                  <MessageEmbeds content={msg.content}/>
                  <MessageReactions
                      reactions={msg.reactions || []}
                      userId={user?.id ?? ""}
                      onReact={(emoji) => handleReact(msg.id, emoji)}
                  />
                </>
              )}
            </div>
              );
            });
            return items;
          })()}
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

          <div className="flex flex-row items-center justify-between mb-1 px-2">
            <span className="text-[10px] uppercase font-bold text-darker-blue/40 dark:text-beige/40 tracking-wider">
              {showPreview ? "Previewing Markdown" : ""}
            </span>
            <button
                onClick={() => setShowPreview(!showPreview)}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
                    showPreview
                        ? "bg-teal text-darker-blue"
                        : "text-teal hover:bg-teal/10"
                }`}
            >
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
          </div>

          {showPreview && input.trim() && (
              <div className="mb-2 p-3 rounded-xl border-2 border-teal/20 bg-beige/50 dark:bg-dark-blue/50 max-h-32 overflow-y-auto">
                <div
                    className="text-darker-blue dark:text-offwhite message-content"
                    dangerouslySetInnerHTML={{ __html: markdownPreview }}
                />
              </div>
          )}

          <div className="flex flex-row items-end gap-2 w-full">
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
              <div className="flex flex-col w-full">
                {replyingTo && (
                    <div className="flex items-center justify-between px-3 py-1.5 mb-1 rounded-lg bg-teal/10 border border-teal/20 text-xs text-teal">
                      <span>Replying to <strong>{replyingTo.author}</strong>: {replyingTo.content.slice(0, 120).trim()}{replyingTo.content.length > 120 ? "…" : ""}</span>
                      <button onClick={() => setReplyingTo(null)}><X size={12} /></button>
                    </div>
                )}
                <div className="relative flex items-center">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKey}
                    placeholder={activeChannel ? `Message #${activeChannel.name}` : ""}
                    disabled={!activeChannel}
                    rows={1}
                    className="flex-1 bg-transparent text-darker-blue dark:text-offwhite placeholder:text-darker-blue/40 dark:placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 pl-5 pr-12 py-2.5 outline-none focus:border-teal/60 transition-colors text-sm resize-none disabled:opacity-40 min-w-0 w-full"
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
              </div>
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
