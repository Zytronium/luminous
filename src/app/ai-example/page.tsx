"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  Hash,
  Mail,
  Settings,
  Bell,
  Pin,
  Users,
  Smile,
  Paperclip,
  SendHorizonal,
  Sun,
  Moon,
} from "lucide-react";
import Image from "next/image";

const CHANNELS = [
  { id: "general", name: "general", unread: 0 },
  { id: "full-stack", name: "full-stack", unread: 3 },
  { id: "machine-learning", name: "machine-learning", unread: 0 },
  { id: "systems-prog", name: "systems-prog", unread: 1 },
  { id: "job-board", name: "job-board", unread: 7 },
  { id: "random", name: "random", unread: 0 },
];

const DMS = [
  { id: "alex", name: "Alex Rivera", avatar: "AR", online: true },
  { id: "morgan", name: "Morgan Lee", avatar: "ML", online: true },
  { id: "jordan", name: "Jordan Kim", avatar: "JK", online: false },
  { id: "sam", name: "Sam Patel", avatar: "SP", online: false },
];

const INITIAL_MESSAGES = [
  {
    id: 1,
    author: "Alex Rivera",
    avatar: "AR",
    time: "9:14 AM",
    text: "Hey everyone! Just got out of the C sprint review — project is looking great 🔥",
    self: false,
  },
  {
    id: 2,
    author: "Morgan Lee",
    avatar: "ML",
    time: "9:16 AM",
    text: "Amazing! Which project is that? The portfolio site or the API?",
    self: false,
  },
  {
    id: 3,
    author: "You",
    avatar: "YO",
    time: "9:18 AM",
    text: "The portfolio — we deployed it to AWS last night. Lumi approved 🪲✨",
    self: true,
  },
  {
    id: 4,
    author: "Jordan Kim",
    avatar: "JK",
    time: "9:21 AM",
    text: "Congrats!! Don't forget the alumni happy hour on Friday at Elgin Park!",
    self: false,
  },
  {
    id: 5,
    author: "Alex Rivera",
    avatar: "AR",
    time: "9:23 AM",
    text: "Will be there 🙌",
    self: false,
  },
];

const HEADER_ACTIONS = [
  { icon: Bell, label: "Notifications" },
  { icon: Pin, label: "Pinned messages" },
  { icon: Users, label: "Members" },
];

function LumiLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "transparent",
          boxShadow: "0 0 12px #54f4d088, 0 0 24px #1ED2AF44",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Image src={'/logo.png'} alt={""} width={18} height={18} className="w-9 h-9 aspect-square" />
      </div>
      <span
        className="text-teal dark:text-darker-blue"
        style={{
          fontFamily: "Galano-Grotesque, Arial, sans-serif",
          fontWeight: 700,
          fontSize: "1.2rem",
          letterSpacing: "-0.03em",
          textShadow: "0 0 16px #54f4d055",
        }}
      >
        Luminous
      </span>
    </div>
  );
}

function Avatar({
  initials,
  online,
  self,
  size = 36,
}: {
  initials: string;
  online?: boolean;
  self?: boolean;
  size?: number;
}) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: self
            ? "linear-gradient(135deg, #1ED2AF, #54f4d0)"
            : "linear-gradient(135deg, #000061, #1ED2AF33)",
          border: self ? "none" : "1.5px solid #1ED2AF44",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.35,
          fontWeight: 700,
          color: self ? "#00002e" : "#54f4d0",
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </div>
      {online !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: online ? "#54f4d0" : "#00000033",
            border: "1.5px solid #1ED2AF44",
            boxShadow: online ? "0 0 6px #54f4d0" : "none",
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  const [activeChannel, setActiveChannel] = useState("general");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [sidebarSection, setSidebarSection] = useState<"channels" | "dms">("channels");
  const [darkMode, setDarkMode] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        author: "You",
        avatar: "YO",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text,
        self: true,
      },
    ]);
    setInput("");
  }

  const activeChannelName =
    CHANNELS.find((c) => c.id === activeChannel)?.name ?? activeChannel;

  return (
    // Wrapping in a div with `dark` class makes all `dark:` Tailwind variants apply
    // based on this state toggle rather than the OS preference.
    <div
      className={darkMode ? "dark" : ""}
      style={{ width: "100vw", height: "100vh", position: "fixed", top: 0, left: 0, fontFamily: "Galano-Grotesque, Arial, sans-serif" }}
    >
      <div className="w-full h-full flex bg-beige dark:bg-darker-blue overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex-shrink-0 bg-[#00001e] dark:bg-[#e8e0c8] border-r border-teal/10 flex flex-col gap-5"
          style={{ width: 260, padding: "20px 12px" }}
        >
          {/* Logo + theme toggle */}
          <div className="flex items-center justify-between" style={{ padding: "0 8px" }}>
            <LumiLogo />
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center rounded-full border border-teal/20 bg-blue/20 dark:bg-beige/60 text-teal hover:opacity-80 transition-opacity cursor-pointer"
              style={{ width: 30, height: 30, flexShrink: 0, background: "none" }}
            >
              {darkMode ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
            </button>
          </div>

          {/* Search */}
          <div
            className="bg-blue/30 dark:bg-beige/60 rounded-full border border-teal/15 flex items-center gap-2"
            style={{ padding: "8px 14px" }}
          >
            <Search size={14} className="text-teal/50" strokeWidth={2} />
            <input
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-offwhite dark:text-darker-blue placeholder-offwhite/30 dark:placeholder-darker-blue/30 w-full"
              style={{ fontSize: 13, fontFamily: "inherit" }}
            />
          </div>

          {/* Toggle tabs */}
          <div
            className="flex bg-blue/30 dark:bg-beige/50 rounded-full"
            style={{ padding: 3, gap: 2 }}
          >
            {(["channels", "dms"] as const).map((tab) => {
              const active = sidebarSection === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setSidebarSection(tab)}
                  className={`flex-1 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${
                    active
                      ? "bg-teal text-darker-blue"
                      : "bg-transparent text-offwhite/60 dark:text-darker-blue/50"
                  }`}
                  style={{
                    border: "none",
                    padding: "6px 0",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    gap: 5,
                    fontFamily: "inherit",
                  }}
                >
                  {tab === "channels" ? (
                    <><Hash size={12} strokeWidth={2.5} />Channels</>
                  ) : (
                    <><Mail size={12} strokeWidth={2.5} />DMs</>
                  )}
                </button>
              );
            })}
          </div>

          {/* Channel / DM List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
            {sidebarSection === "channels"
              ? CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`flex items-center justify-between rounded-full transition-all duration-150 cursor-pointer ${
                      active
                        ? "bg-gradient-to-r from-teal/20 to-neon-teal/10 text-neon-teal dark:text-darker-blue outline outline-1 outline-teal/25 font-bold"
                        : "bg-transparent text-offwhite/70 dark:text-darker-blue/60 font-normal"
                    }`}
                    style={{ padding: "8px 12px", border: "none", fontSize: 14, textAlign: "left", fontFamily: "inherit" }}
                  >
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Hash
                          size={13}
                          strokeWidth={active ? 2.5 : 2}
                          color={active ? (darkMode ? "#00002e" : "#54f4d0") : undefined}
                          className={active ? "" : "text-offwhite/40 dark:text-darker-blue/40"}
                        />
                        {ch.name}
                      </span>
                    {ch.unread > 0 && (
                      <span
                        className="bg-teal text-darker-blue rounded-full font-bold"
                        style={{ fontSize: 10, padding: "1px 7px", boxShadow: "0 0 8px #1ED2AF55" }}
                      >
                          {ch.unread}
                        </span>
                    )}
                  </button>
                );
              })
              : DMS.map((dm) => {
                const active = activeChannel === dm.id;
                return (
                  <button
                    key={dm.id}
                    onClick={() => setActiveChannel(dm.id)}
                    className={`flex items-center rounded-full transition-all duration-150 cursor-pointer ${
                      active
                        ? "bg-gradient-to-r from-teal/20 to-neon-teal/10 text-neon-teal dark:text-darker-blue outline outline-1 outline-teal/25 font-bold"
                        : "bg-transparent text-offwhite/70 dark:text-darker-blue/60 font-normal"
                    }`}
                    style={{ gap: 10, padding: "7px 12px", border: "none", fontSize: 14, textAlign: "left", fontFamily: "inherit" }}
                  >
                    <Avatar initials={dm.avatar} online={dm.online} size={28} />
                    <span>{dm.name}</span>
                  </button>
                );
              })}
          </div>

          {/* User Footer */}
          <div
            className="flex items-center gap-2.5 rounded-full bg-blue/30 dark:bg-beige/50 border border-teal/10"
            style={{ padding: "10px 12px" }}
          >
            <Avatar initials="YO" self online size={32} />
            <div style={{ flex: 1 }}>
              <div className="text-offwhite dark:text-darker-blue font-bold" style={{ fontSize: 13 }}>You</div>
              <div className="text-teal/70" style={{ fontSize: 11 }}>Atlas '25 · Online</div>
            </div>
            <button
              title="Settings"
              className="text-teal/50 hover:opacity-80 transition-opacity flex items-center justify-center rounded-lg cursor-pointer"
              style={{ background: "none", border: "none", padding: 4 }}
            >
              <Settings size={16} strokeWidth={2} />
            </button>
          </div>
        </aside>

        {/* ── Main Chat ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <header
            className="border-b border-teal/10 flex items-center justify-between flex-shrink-0 bg-beige/80 dark:bg-darker-blue/80 backdrop-blur-md"
            style={{ padding: "14px 24px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Hash size={18} color="#1ED2AF" strokeWidth={2.5} />
              <span className="text-darker-blue dark:text-offwhite font-bold" style={{ fontSize: 16 }}>
                {activeChannelName}
              </span>
              <span
                className="text-teal/60"
                style={{ fontSize: 12, paddingLeft: 10, borderLeft: "1px solid #1ED2AF22", marginLeft: 4 }}
              >
                Atlas School students &amp; alumni
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {HEADER_ACTIONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  title={label}
                  className="bg-white/60 dark:bg-dark-blue border border-teal/15 rounded-full text-teal/60 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ width: 34, height: 34 }}
                >
                  <Icon size={15} strokeWidth={2} />
                </button>
              ))}
            </div>
          </header>

          {/* Messages */}
          <div
            style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 }}
          >
            {/* Day divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 16px" }}>
              <div className="flex-1 h-px bg-teal/10" />
              <span
                className="bg-white/70 dark:bg-dark-blue text-teal/70 font-bold border border-teal/15 rounded-full"
                style={{ fontSize: 11, letterSpacing: "0.06em", padding: "3px 12px" }}
              >
                TODAY
              </span>
              <div className="flex-1 h-px bg-teal/10" />
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{ display: "flex", flexDirection: msg.self ? "row-reverse" : "row", alignItems: "flex-end", gap: 10, marginBottom: 6 }}
              >
                <Avatar initials={msg.avatar} self={msg.self} size={36} />
                <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", alignItems: msg.self ? "flex-end" : "flex-start", gap: 3 }}>
                  {!msg.self && (
                    <span className="text-teal font-bold" style={{ fontSize: 12, paddingLeft: 4 }}>
                      {msg.author}
                    </span>
                  )}
                  <div
                    className={msg.self ? "" : "bg-white/80 dark:bg-dark-blue text-darker-blue dark:text-offwhite border border-teal/10"}
                    style={{
                      background: msg.self ? "linear-gradient(135deg, #1ED2AF, #54f4d0)" : undefined,
                      color: msg.self ? "#00002e" : undefined,
                      border: msg.self ? "none" : undefined,
                      borderRadius: msg.self ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                      padding: "10px 16px",
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontWeight: msg.self ? 600 : 400,
                      boxShadow: msg.self ? "0 0 20px #1ED2AF33" : "0 2px 8px #00000011",
                    }}
                  >
                    {msg.text}
                  </div>
                  <span
                    className="text-darker-blue/30 dark:text-offwhite/25"
                    style={{ fontSize: 10, paddingLeft: 4, paddingRight: 4 }}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Typing indicator */}
          <div className="text-teal/60" style={{ padding: "0 24px 6px", fontSize: 11, height: 18 }}>
            Alex Rivera is typing...
          </div>

          {/* Input */}
          <div style={{ padding: "0 24px 20px", flexShrink: 0 }}>
            <div
              className="flex items-center gap-2.5 bg-white/80 dark:bg-dark-blue border border-teal/20 rounded-full"
              style={{ padding: "8px 8px 8px 20px", boxShadow: "0 0 24px #1ED2AF11", transition: "border-color 0.2s" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={`Message #${activeChannelName}`}
                className="flex-1 bg-transparent border-none outline-none text-darker-blue dark:text-offwhite placeholder-darker-blue/30 dark:placeholder-offwhite/20"
                style={{ fontSize: 14, fontFamily: "Galano-Grotesque, Arial, sans-serif" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  title="Emoji"
                  className="text-teal/40 hover:text-teal/70 flex items-center rounded-full transition-colors cursor-pointer"
                  style={{ background: "none", border: "none", padding: "4px 6px" }}
                >
                  <Smile size={18} strokeWidth={2} />
                </button>
                <button
                  title="Attach file"
                  className="text-teal/40 hover:text-teal/70 flex items-center rounded-full transition-colors cursor-pointer"
                  style={{ background: "none", border: "none", padding: "4px 6px" }}
                >
                  <Paperclip size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={sendMessage}
                  title="Send"
                  style={{
                    background: input.trim() ? "linear-gradient(135deg, #1ED2AF, #54f4d0)" : "#1ED2AF22",
                    border: "none",
                    borderRadius: 999,
                    width: 38,
                    height: 38,
                    cursor: input.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    boxShadow: input.trim() ? "0 0 16px #1ED2AF55" : "none",
                    flexShrink: 0,
                    color: input.trim() ? "#00002e" : "#1ED2AF55",
                  }}
                >
                  <SendHorizonal size={17} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </main>

        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #1ED2AF33; border-radius: 999px; }
          ::-webkit-scrollbar-thumb:hover { background: #1ED2AF66; }
          body { overflow: hidden; }
          button:hover { opacity: 0.85; }
        `}</style>
      </div>
    </div>
  );
}