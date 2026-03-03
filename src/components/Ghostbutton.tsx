"use client";

import Link from "next/link";

export default function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex-1 text-center font-semibold py-3 rounded-2xl"
      style={{
        background: "rgba(254,249,230,0.06)",
        border: "1.5px solid rgba(254,249,230,0.15)",
        color: "rgba(254,249,230,0.75)",
        fontSize: "0.95rem",
        transition: "background 0.2s, border-color 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(254,249,230,0.1)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(254,249,230,0.3)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(254,249,230,0.06)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(254,249,230,0.15)";
      }}
    >
      {children}
    </Link>
  );
}