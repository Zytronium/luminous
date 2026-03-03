"use client";
import { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { SendHorizonal } from "lucide-react";

const CHANNELS = [
  { id: "general",  name: "General", description: "General Atlas School discussion" },
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
  const [messages, setMessages] = useState({ general: [], random: [] });
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const msg = { id: Date.now(), author: "You", content: text, time: getNow() };
    setMessages(m => ({ ...m, [active]: [...m[active], msg] }));
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const msgs = messages[active] ?? [];

  return (
    <div className="flex flex-row justify-between h-screen w-screen gap-8 py-0 my-0 fixed top-0">
      <Sidebar channels={CHANNELS} active={active} setActive={setActive} user={{ displayName: "John Doe" }} />
      <div className="flex flex-col h-screen w-full justify-between items-center">
        <div className="w-full h-10 border-b-2 border-beige/25 mt-2">
          <span className="text-teal font-black text-xl">#</span>
          {" "}
          <span className="text-offwhite font-bold text-lg">{get_channel_name(active)}</span>
          <span className="text-teal/75 font-medium text-xs ml-5 border-l border-teal/25 pl-4">
            {get_channel_descr(active)}
          </span>
        </div>
          <div className="flex flex-row items-center gap-2 w-full px-4 pb-4">
            <input
              type="text"
              placeholder={`Message #${get_channel_name(active)}`}
              className="flex-1 bg-transparent text-offwhite placeholder:text-beige/40 rounded-full h-11 border-2 border-teal/25 px-5 outline-none focus:border-teal/60 transition-colors text-sm"
            />
            <button className="flex-shrink-0 w-11 h-11 rounded-full bg-teal flex items-center justify-center hover:brightness-90 transition-all">
              <SendHorizonal className="text-darker-blue" size={24} />
            </button>
        </div>
      </div>
    </div>
  );
}
