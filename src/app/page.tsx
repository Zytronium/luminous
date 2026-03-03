import Link from "next/link";
import Image from "next/image";
import GhostButton from "@/components/Ghostbutton";

export default function Home() {
  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.04); }
        }
        @keyframes pulse-ring-2 {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.18; transform: scale(1.07); }
        }
        @keyframes glow-drift {
          0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-float       { animation: float 5s ease-in-out infinite; }
        .animate-pulse-ring  { animation: pulse-ring 4s ease-in-out infinite; }
        .animate-pulse-ring2 { animation: pulse-ring-2 4s ease-in-out infinite 0.8s; }
        .animate-glow        { animation: glow-drift 6s ease-in-out infinite; }

        .fade-up-1 { animation: fade-up 0.7s ease both 0.1s; opacity: 0; }
        .fade-up-2 { animation: fade-up 0.7s ease both 0.25s; opacity: 0; }
        .fade-up-3 { animation: fade-up 0.7s ease both 0.4s; opacity: 0; }
        .fade-up-4 { animation: fade-up 0.7s ease both 0.55s; opacity: 0; }
        .fade-up-5 { animation: fade-up 0.7s ease both 0.7s; opacity: 0; }

        .shimmer-text {
          display: inline-block;
          background: linear-gradient(
            90deg,
            #1ED2AF 0%, #54f4d0 40%, #1ED2AF 60%, #54f4d0 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
          animation: shimmer 4s linear infinite;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-3px);
        }

        .btn-glow:hover {
          box-shadow: 0 0 24px 4px rgba(30, 210, 175, 0.4);
        }
        .btn-glow {
          transition: box-shadow 0.25s ease, filter 0.25s ease;
        }
      `}</style>

      {/* ── Page shell ── */}
      <div className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden">

        {/* ── Background glow orb ── */}
        <div
          className="animate-glow pointer-events-none"
          style={{
            position: "fixed",
            top: "42%",
            left: "50%",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(30,210,175,0.18) 0%, transparent 70%)",
            transform: "translate(-50%, -50%)",
            zIndex: 0,
          }}
        />

        {/* ── Main card ── */}
        <div
          className="relative z-10 flex flex-col items-center w-full max-w-lg mx-4 px-10 py-14"
          style={{
            background: "rgba(0, 0, 60, 0.72)",
            border: "2px solid rgba(254, 249, 230, 0.12)",
            borderRadius: "3rem",
            backdropFilter: "blur(24px)",
            boxShadow: "0 8px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(254,249,230,0.08)",
          }}
        >
          {/* Pulse rings behind logo */}
          <div className="relative flex items-center justify-center mb-8">
            <div
              className="animate-pulse-ring2 absolute"
              style={{
                width: 100, height: 100,
                borderRadius: "50%",
                border: "2px solid #1ED2AF",
              }}
            />
            <div
              className="animate-pulse-ring absolute"
              style={{
                width: 76, height: 76,
                borderRadius: "50%",
                border: "2px solid #1ED2AF",
              }}
            />
            {/* Logo */}
            <div
              className="animate-float relative z-10 flex items-center justify-center"
              style={{
                width: 64, height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #000061, #00003c)",
                border: "2px solid rgba(30,210,175,0.5)",
                boxShadow: "0 0 20px rgba(30,210,175,0.3)",
              }}
            >
              <Image
                src="/logo.png"
                alt="Luminous"
                width={64}
                height={64}
                style={{ borderRadius: "50%" }}
              />
            </div>
          </div>

          {/* Title */}
          <h1
            className="fade-up-2 text-center"
            style={{ fontSize: "clamp(2.4rem, 6vw, 3.2rem)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.1, marginBottom: "0.6rem" }}
          >
            <span className="shimmer-text">Luminous</span>
          </h1>

          {/* Tagline */}
          <p
            className="fade-up-3 text-center"
            style={{ color: "rgba(254,249,230,0.55)", fontSize: "1rem", lineHeight: 1.6, maxWidth: 320, marginBottom: "2.5rem" }}
          >
            The unofficial chat space for Atlas students and alumni
          </p>

          {/* CTA buttons */}
          <div className="fade-up-5 flex flex-col sm:flex-row gap-3 w-full">
            <Link
              href="/auth"
              className="btn-glow flex-1 text-center font-bold py-3 rounded-2xl transition-all"
              style={{
                background: "#1ED2AF",
                color: "#00002e",
                fontSize: "0.95rem",
                letterSpacing: "0.02em",
              }}
            >
              Sign In / Join
            </Link>
            <GhostButton href="/ai-example">Preview UI</GhostButton>
          </div>
        </div>
      </div>
    </>
  );
}
