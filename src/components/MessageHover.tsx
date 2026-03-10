import { useState, lazy, Suspense, useRef} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import MessageOptions from './MessageOptions';
import { Theme } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const DefaultIcon = "/face-grin.png";
const ReactIcons = [
    "/face-frown.png",
    "/face-grin-hearts.png",
    "/face-grin-squint-tears.png",
    "/face-grin-tongue.png",
    "/face-rolling-eyes.png",
    "/face-surprise.png"
];

interface MessageHoverProps {
    messageId: string;
    authorId: string;
    userId: string;
    onEdit: (messageId: string) => void;
    onDelete: (messageId: string) => void;
	onReact: (messageId: string, emoji: string) => void;
}

export default function MessageHover({ messageId, authorId, userId, onEdit, onDelete, onReact }: MessageHoverProps) {
    const isOwnMessage = authorId === userId;
    const [showReactions, setShowReactions] = useState(false);
    const [currentIcon, setCurrentIcon] = useState(DefaultIcon);
    const [pickerCoords, setPickerCoords] = useState({ top: 0, left: 0, isBottom: false });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMouseEnter = () => {
        const randomIcon = ReactIcons[Math.floor(Math.random() * ReactIcons.length)];
        setCurrentIcon(randomIcon);
    };

    const handleMouseLeave = () => {
        setCurrentIcon(DefaultIcon);
    };

    const togglePicker = () => {
        if (!showReactions && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceAbove = rect.top;
            const openDownward = spaceAbove < 450;

            setPickerCoords({
                top: openDownward ? rect.bottom + 10 : rect.top - 410,
                left: rect.left - 300,
                isBottom: openDownward
            });
        }
        setShowReactions(!showReactions);
    };

    return (
        <div className="relative flex items-center gap-1 bg-darkest-blue/80 backdrop-blur-sm border border-teal p-1 rounded-lg shadow-xl">
            <button
                ref={buttonRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={togglePicker}
                className={`hover:bg-teal/20 p-1.5 rounded-md transition-all active:scale-95 flex items-center justify-center ${showReactions ? 'bg-teal/30' : ''}`}
                title="Add Reaction"
            >
                <Image src={currentIcon} alt='reactions' width={18} height={18} className="transition-transform duration-150 transform hover:scale-110" />
            </button>

            {showReactions && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed z-9999 shadow-2xl animate-in fade-in zoom-in duration-150"
                    style={{ top: pickerCoords.top, left: pickerCoords.left }}
                >
                    <Suspense fallback={
                        <div className="bg-darkest-blue border border-teal p-4 rounded-lg text-white text-sm w-350px h-400px flex items-center justify-center">
                            Loading Emojis...
                        </div>
                    }>
                        <EmojiPicker 
                            lazyLoadEmojis={true}
                            width={350}
                            height={400}
                            theme={Theme.DARK}
                            style={{
                                "--epr-bg-color": "#071927",
                                "--epr-category-label-bg-color": "#071927",
                                "--epr-picker-border-color": "#008080",
                                "--epr-highlight-color": "#008080",
                                "--epr-text-color": "#ffffff",
                            } as React.CSSProperties}
                            onEmojiClick={(emojiData) => {
                                onReact(messageId, emojiData.emoji);
                                setShowReactions(false);
                            }} 
                        />
                    </Suspense>
                </div>,
                document.body
            )}

            <button
                onClick={() => console.log("Replying to:", messageId)}
                className="hover:bg-teal/20 p-1.5 rounded-md transition-all active:scale-95 flex items-center justify-center"
                title="Reply"
            >
                <Image src="/reply.png" alt='reply' width={18} height={18}/>
            </button>

            <MessageOptions
                isOwnMessage={isOwnMessage}
                onEdit={() => onEdit(messageId)}
                onDelete={() => onDelete(messageId)}
            />
        </div>
    );
};