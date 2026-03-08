import React from 'react';
import Image from 'next/image';
import MessageOptions from './MessageOptions';

interface MessageHoverProps {
  messageId: string;
  authorId: string;
  userId: string;
}

export default function MessageHover({ messageId, authorId, userId }: MessageHoverProps) {
    const isOwnMessage = authorId === userId; 
    
    return (
        <div className="flex items-center gap-1 bg-darkest-blue/80 backdrop-blur-sm border border-teal p-1 rounded-lg shadow-xl">
            <button 
                onClick={() => console.log("Replying to:", messageId)}
                className="hover:bg-teal/20 p-1.5 rounded-md transition-all active:scale-95 flex items-center justify-center"
                title="Reply"
            >
                <Image src="/reply.png" alt='reply' width={18} height={18}/>
            </button>
            
            <MessageOptions isOwnMessage={isOwnMessage}/>
        </div>
    );
};