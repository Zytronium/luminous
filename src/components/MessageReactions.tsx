import { Reaction } from "@/app/chat/page";

export default function MessageReactions({ reactions }: { reactions: Reaction[] }) {
  if (!reactions || reactions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1 ml-10">
      {reactions.map((res, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal/10 border border-teal/30 text-xs text-offwhite">
          <span>{res.emoji}</span>
          <span className="font-bold text-teal">{res.count}</span>
        </div>
      ))}
    </div>
  );
}