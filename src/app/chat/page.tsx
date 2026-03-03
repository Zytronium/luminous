"use client";
import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal } from "lucide-react";

type Message = { id: number; author: string; content: string; time: string };

const CHANNELS = [
  { id: "general", name: "General", description: "General Atlas School discussion" },
  { id: "random", name: "Random", description: "Random off-topic chat" },
];

function get_channel_name(id: string) {
  for (const channel of CHANNELS) {
    if (channel.id === id)
      return channel.name;
  }

  return "Unknown";
}

function get_channel_descr(id: string) {
  for (const channel of CHANNELS) {
    if (channel.id === id)
      return channel.description;
  }

  return "Unknown";
}

function getNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const [active, setActive] = useState("general");
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    general: [],
    random: []
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const msg: Message = { id: Date.now(), author: "You", content: text, time: getNow() };
    setMessages(m => ({ ...m, [active]: [...m[active], msg] }));
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const msgs = messages[active] ?? [];

  return (
    <div className="flex flex-row justify-between h-screen w-screen gap-2 py-0 my-0 fixed top-0">
      <Sidebar channels={CHANNELS} active={active} setActive={setActive}
               user={{ displayName: "John Doe" }} />
      <div className="flex flex-col h-screen w-full justify-between items-center">
        <div className="w-full h-10 border-b-2 border-beige/25 mt-2">
          <span className="text-teal font-black text-xl ml-4">#</span>
          {" "}
          <span className="text-offwhite font-bold text-lg">{get_channel_name(active)}</span>
          <span className="text-teal/75 font-medium text-xs ml-5 border-l border-teal/25 pl-4">
            {get_channel_descr(active)}
          </span>
        </div>
        <div className="flex-1 w-full">
          {msgs.length === 0 && (<p className="text-center text-offwhite/75 text-sm mt-4" style={{}}>
            Channel empty. Be the first to say something!
          </p>)}
          {msgs.map(msg => (
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
        <div className="flex flex-row items-center gap-2 w-full px-4 pb-4">
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message #${get_channel_name(active)}`}
            rows={1}
            className="flex-1 bg-transparent text-offwhite placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 px-5 py-2.5 outline-none focus:border-teal/60 transition-colors text-sm resize-none"
          />
          <button
            onClick={send}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-teal flex items-center justify-center hover:brightness-90 transition-all"
          >
            <SendHorizonal className="text-darker-blue" size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
