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
  Bug,
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
        style={{
          fontFamily: "Galano-Grotesque, Arial, sans-serif",
          fontWeight: 700,
          fontSize: "1.2rem",
          color: "#54f4d0",
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
            background: online ? "#54f4d0" : "#ffffff33",
            border: "1.5px solid #00003c",
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
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#00002e",
        fontFamily: "Galano-Grotesque, Arial, sans-serif",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: "#00001e",
          borderRight: "1px solid #1ED2AF18",
          display: "flex",
          flexDirection: "column",
          padding: "20px 12px",
          gap: 20,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "0 8px" }}>
          <LumiLogo />
        </div>

        {/* Search */}
        <div
          style={{
            background: "#00003c",
            borderRadius: 999,
            border: "1px solid #1ED2AF22",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
          }}
        >
          <Search size={14} color="#1ED2AF88" strokeWidth={2} />
          <input
            placeholder="Search..."
            style={{
              background: "none",
              border: "none",
              outline: "none",
              color: "#fef9e6",
              fontSize: 13,
              width: "100%",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Toggle tabs */}
        <div
          style={{
            display: "flex",
            background: "#00003c",
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}
        >
          {(["channels", "dms"] as const).map((tab) => {
            const active = sidebarSection === tab;
            return (
              <button
                key={tab}
                onClick={() => setSidebarSection(tab)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  border: "none",
                  padding: "6px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: active ? "#1ED2AF" : "transparent",
                  color: active ? "#00002e" : "#1ED2AF88",
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  fontFamily: "inherit",
                }}
              >
                {tab === "channels" ? (
                  <>
                    <Hash size={12} strokeWidth={2.5} />
                    Channels
                  </>
                ) : (
                  <>
                    <Mail size={12} strokeWidth={2.5} />
                    DMs
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Channel / DM List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
            overflowY: "auto",
          }}
        >
          {sidebarSection === "channels"
            ? CHANNELS.map((ch) => {
              const active = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: active
                      ? "linear-gradient(90deg, #1ED2AF22, #54f4d011)"
                      : "transparent",
                    color: active ? "#54f4d0" : "#fef9e6aa",
                    fontWeight: active ? 700 : 400,
                    fontSize: 14,
                    textAlign: "left",
                    outline: active ? "1px solid #1ED2AF33" : "none",
                    fontFamily: "inherit",
                  }}
                >
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Hash
                        size={13}
                        strokeWidth={active ? 2.5 : 2}
                        color={active ? "#54f4d0" : "#fef9e688"}
                      />
                      {ch.name}
                    </span>
                  {ch.unread > 0 && (
                    <span
                      style={{
                        background: "#1ED2AF",
                        color: "#00002e",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 7px",
                        boxShadow: "0 0 8px #1ED2AF66",
                      }}
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: active
                      ? "linear-gradient(90deg, #1ED2AF22, #54f4d011)"
                      : "transparent",
                    color: active ? "#54f4d0" : "#fef9e6aa",
                    fontWeight: active ? 700 : 400,
                    fontSize: 14,
                    textAlign: "left",
                    outline: active ? "1px solid #1ED2AF33" : "none",
                    fontFamily: "inherit",
                  }}
                >
                  <Avatar initials={dm.avatar} online={dm.online} size={28} />
                  <span>{dm.name}</span>
                </button>
              );
            })}
        </div>

        {/* User Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 999,
            background: "#00003c",
            border: "1px solid #1ED2AF18",
          }}
        >
          <Avatar initials="YO" self online size={32} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fef9e6" }}>You</div>
            <div style={{ fontSize: 11, color: "#1ED2AF99" }}>Atlas '25 · Online</div>
          </div>
          <button
            title="Settings"
            style={{
              background: "none",
              border: "none",
              color: "#1ED2AF66",
              cursor: "pointer",
              padding: 4,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={16} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* ── Main Chat ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <header
          style={{
            padding: "14px 24px",
            borderBottom: "1px solid #1ED2AF18",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#00002ecc",
            backdropFilter: "blur(12px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Hash size={18} color="#1ED2AF" strokeWidth={2.5} />
            <span style={{ fontWeight: 700, fontSize: 16, color: "#fef9e6" }}>
              {activeChannelName}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#1ED2AF88",
                paddingLeft: 10,
                borderLeft: "1px solid #1ED2AF22",
                marginLeft: 4,
              }}
            >
              Atlas School students &amp; alumni
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {HEADER_ACTIONS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                title={label}
                style={{
                  background: "#00003c",
                  border: "1px solid #1ED2AF22",
                  borderRadius: 999,
                  width: 34,
                  height: 34,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1ED2AF99",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={15} strokeWidth={2} />
              </button>
            ))}
          </div>
        </header>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* Day divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "8px 0 16px",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#1ED2AF18" }} />
            <span
              style={{
                fontSize: 11,
                color: "#1ED2AF88",
                fontWeight: 700,
                letterSpacing: "0.06em",
                background: "#00003c",
                padding: "3px 12px",
                borderRadius: 999,
                border: "1px solid #1ED2AF22",
              }}
            >
              TODAY
            </span>
            <div style={{ flex: 1, height: 1, background: "#1ED2AF18" }} />
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: msg.self ? "row-reverse" : "row",
                alignItems: "flex-end",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <Avatar initials={msg.avatar} self={msg.self} size={36} />
              <div
                style={{
                  maxWidth: "65%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.self ? "flex-end" : "flex-start",
                  gap: 3,
                }}
              >
                {!msg.self && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1ED2AF",
                      paddingLeft: 4,
                    }}
                  >
                    {msg.author}
                  </span>
                )}
                <div
                  style={{
                    background: msg.self
                      ? "linear-gradient(135deg, #1ED2AF, #54f4d0)"
                      : "#00003c",
                    color: msg.self ? "#00002e" : "#fef9e6",
                    border: msg.self ? "none" : "1px solid #1ED2AF1a",
                    borderRadius: msg.self
                      ? "22px 22px 6px 22px"
                      : "22px 22px 22px 6px",
                    padding: "10px 16px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontWeight: msg.self ? 600 : 400,
                    boxShadow: msg.self
                      ? "0 0 20px #1ED2AF33"
                      : "0 2px 8px #00000033",
                  }}
                >
                  {msg.text}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "#ffffff44",
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  {msg.time}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Typing indicator */}
        <div
          style={{
            padding: "0 24px 6px",
            fontSize: 11,
            color: "#1ED2AF88",
            height: 18,
          }}
        >
          Alex Rivera is typing...
        </div>

        {/* Input */}
        <div style={{ padding: "0 24px 20px", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#00003c",
              border: "1.5px solid #1ED2AF33",
              borderRadius: 999,
              padding: "8px 8px 8px 20px",
              boxShadow: "0 0 24px #1ED2AF11",
              transition: "border-color 0.2s",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Message #${activeChannelName}`}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#fef9e6",
                fontSize: 14,
                fontFamily: "Galano-Grotesque, Arial, sans-serif",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                title="Emoji"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#1ED2AF55",
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  transition: "color 0.15s",
                }}
              >
                <Smile size={18} strokeWidth={2} />
              </button>
              <button
                title="Attach file"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#1ED2AF55",
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  transition: "color 0.15s",
                }}
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>
              <button
                onClick={sendMessage}
                title="Send"
                style={{
                  background: input.trim()
                    ? "linear-gradient(135deg, #1ED2AF, #54f4d0)"
                    : "#1ED2AF22",
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
        input::placeholder { color: #ffffff33; }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
