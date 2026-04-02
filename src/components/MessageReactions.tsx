import { Reaction } from "@/app/chat/page";

type Props = {
  reactions: Reaction[];
  userId: string;
  onReact: (emoji: string) => void;
};

export default function MessageReactions({ reactions, userId, onReact }: Props) {
  if (!reactions || reactions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1 ml-10">
      {reactions.map((res, i) => {
        const reacted = res.users.includes(userId);
        return (
          <button
            key={i}
            onClick={() => onReact(res.emoji)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs transition-colors cursor-pointer
              ${reacted
                ? "bg-teal/25 border-teal text-teal"
                : "bg-teal/10 border-teal/30 text-offwhite hover:bg-teal/20 hover:border-teal/60"
              }`}
          >
          <span>{res.emoji}</span>
          <span className="font-bold text-teal">{res.count}</span>
          </button>
        );
      })}
    </div>
  );
}