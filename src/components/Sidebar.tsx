import Image from "next/image";

type Channel = { id: string; name: string };

type SidebarProps = {
  channels: Channel[];
  active: string;
  setActive: (id: string) => void;
  user: { displayName: string };
};

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Image src={'/logo.png'} alt={""} width={18} height={18} className="w-9 h-9 aspect-square" />
      </div>
      <span
        className="text-blue font-black"
        style={{
          fontFamily: "Galano-Grotesque, Arial, sans-serif",
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

function UserStrip({ user }: { user: { displayName: string } }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <div className="w-8 h-8 rounded-full bg-darker-blue/75 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-neon-teal">
          <circle cx="12" cy="8" r="4" fill="currentColor" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
        </svg>
      </div>

      <span className="text-sm font-semibold text-darker-blue truncate flex-1">
        {user.displayName}
      </span>

      <button className="flex-shrink-0 p-1 rounded-full hover:bg-darker-blue/15 transition-all cursor-pointer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-darker-blue/70">
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function Sidebar({ channels, active, setActive, user }: SidebarProps) {
  return (
    <div className="rounded-r-4xl bg-neon-teal dark:bg-teal p-2 h-screen flex flex-col">
      <Logo/>
      <hr className="my-2 border-darker-blue/25" />
      <div className="flex flex-row justify-center mt-2 mb-4 mx-auto">
        <span className="whitespace-nowrap bg-darker-blue/75 text-sm rounded-l-full px-4 py-1.5 cursor-pointer hover:bg-darker-blue/85 transition-all border-r border-darker-blue/25">Channels</span>
        <span className="whitespace-nowrap bg-darker-blue/25 text-sm rounded-r-full px-4 py-1.5 cursor-pointer hover:bg-darker-blue/35 transition-all">User DMs</span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setActive(ch.id)}
            className={`text-left text-sm px-3 py-1.5 rounded-full transition-all cursor-pointer
              ${active === ch.id
                ? "bg-darker-blue/75 text-offwhite"
                : "text-darker-blue hover:bg-darker-blue/15"
              }`}
          >
            # {ch.name}
          </button>
        ))}
      </div>
      <hr className="my-2 border-darker-blue/25" />
      <UserStrip user={user} />
    </div>
  );
}
