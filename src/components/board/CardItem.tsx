"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { CardModal } from "@/components/modals/card-modal/CardModal";
import { useAction } from "@/hooks/use-action";
import { deleteCard } from "@/actions/delete-card";
import { copyCard } from "@/actions/copy-card";
import { pasteCard } from "@/actions/paste-card";

export const CardItem = ({ data, index, boardId }: { data: any; index: number; boardId: string }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const { execute: executeDeleteCard } = useAction(deleteCard);
    const { execute: executeCopyCard } = useAction(copyCard);
    const { execute: executePasteCard } = useAction(pasteCard);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent list context menu from opening
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleMenuClose = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setContextMenu(null);
    };

    const onDeleteCard = () => {
        executeDeleteCard({ id: data.id, boardId });
        handleMenuClose();
    };

    const onDuplicateCard = () => {
        executeCopyCard({ id: data.id, boardId });
        handleMenuClose();
    };

    const onCopyCard = () => {
        localStorage.setItem("trello_clipboard_card", data.id);
        handleMenuClose();
    };

    const onPasteCard = () => {
        const clipboardCardId = localStorage.getItem("trello_clipboard_card");
        if (clipboardCardId) {
            executePasteCard({ sourceCardId: clipboardCardId, targetListId: data.listId, boardId });
        }
        handleMenuClose();
    };

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: data.id,
        data: {
            type: "Card",
            card: data,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const getRenderableImageUrl = (url: string) => {
        if (!url) return null;
        if (url.includes("dropbox.com") && url.includes("dl=0")) {
            return url.replace("dl=0", "raw=1");
        }
        return url;
    };

    const coverImageAttachment = data.attachments?.find((a: any) => a.type === "IMAGE" && a.isCover)
        || data.attachments?.find((a: any) => a.type === "IMAGE");
    const renderableImageUrl = coverImageAttachment ? getRenderableImageUrl(coverImageAttachment.url) : null;

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-30 border-2 border-neutral-500 truncate py-2 px-3 text-sm bg-black text-white rounded-md shadow-sm"
            >
                {data.title}
            </div>
        );
    }

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                role="button"
                onClick={() => setIsModalOpen(true)}
                onContextMenu={handleContextMenu}
                className="group border-2 border-transparent hover:border-neutral-500 text-sm bg-black text-white rounded-md shadow-sm flex flex-col overflow-hidden relative"
            >
                {renderableImageUrl && (
                    <div className="w-full relative flex items-center justify-center bg-neutral-200">
                        <img src={renderableImageUrl} alt="Card Cover" className="w-full h-auto object-cover" />
                    </div>
                )}
                <div className={`py-2 px-3 truncate w-full ${!renderableImageUrl ? "min-h-[36px]" : ""}`}>
                    {data.title}
                </div>
            </div>

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={handleMenuClose} onContextMenu={handleMenuClose} />
                    <div
                        className="fixed z-[70] bg-white border border-neutral-200 shadow-xl rounded-md py-1.5 w-48 text-sm text-neutral-800"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <span className="block px-3 py-1.5 text-xs font-semibold text-neutral-500 border-b mb-1 uppercase tracking-wider">Card Actions</span>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition text-red-600 font-medium">Delete Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Duplicate Card</button>
                        <div className="border-t my-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); onCopyCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Copy Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onPasteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Paste Card</button>
                    </div>
                </>
            )}

            <CardModal
                data={data}
                boardId={boardId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
};
