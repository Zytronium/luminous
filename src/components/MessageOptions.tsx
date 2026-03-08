import { useState } from "react";
import Image from "next/image";

interface MessageOptionsProps {
    isOwnMessage: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

export default function MessageOptions({ isOwnMessage, onEdit, onDelete }: MessageOptionsProps) {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    if (!isOwnMessage) return null;

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const closeDropdown = () => {
        setIsOpen(false);
    };

    return (
        <div className="relative flex items-center justify-center">
            <button
                type="button"
                className="flex items-center justify-center w-8 h-8 hover:bg-teal/20 rounded-md transition-all active:scale-95 leading-none"
                onClick={toggleDropdown}
            >
                <Image
                    src="/ellipsis.png"
                    alt='ellipsis'
                    width={18}
                    height={18}
                    className="block object-contain"
                />
            </button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 top-full mt-2 w-44 rounded-lg shadow-lg bg-darkest-blue ring-1 ring-teal ring-opacity-5 z-50">
                    <ul role="menu" className="py-1" aria-orientation="vertical" aria-labelledby="options-menu">
                        <li>
                            <button
                                className="flex items-center w-full px-4 py-2 text-sm text-teal hover:bg-dark-blue transition-colors"
                                onClick={() => { onEdit(); closeDropdown(); }}
                            >
                                <Image src="/edit.png" alt="Edit" width={16} height={16} className="mr-2" />
                                <span>Edit</span>
                            </button>
                        </li>
                        <li>
                            <button
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-dark-blue transition-colors"
                                onClick={() => { onDelete(); closeDropdown(); }}
                            >
                                <Image src="/delete.png" alt="Delete" width={16} height={16} className="mr-2" />
                                <span>Delete</span>
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}