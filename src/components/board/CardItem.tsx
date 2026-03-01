"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { CardModal } from "@/components/modals/card-modal/CardModal";
import { useAction } from "@/hooks/use-action";
import { deleteCard } from "@/actions/delete-card";
import { copyCard } from "@/actions/copy-card";
import { pasteCard } from "@/actions/paste-card";
import { AlignLeft, CheckSquare, Clock, Paperclip } from "lucide-react";
import { format } from "date-fns";

const renderTitleWithLinks = (titleText: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (!urlRegex.test(titleText)) return titleText;

    const parts = titleText.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500 hover:text-blue-400"
                    onDoubleClick={(e) => e.stopPropagation()} // Prevent double-clicking the link from opening the modal
                    onClick={(e) => e.stopPropagation()}
                >
                    {part.length > 40 ? part.substring(0, 40) + '...' : part}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
};

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
        disabled: isModalOpen,
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

    const coverImageAttachment = data.attachments?.find((a: any) => a.isCover)
        || data.attachments?.find((a: any) => a.type === "IMAGE" || a.thumbnailUrl);
    const renderableImageUrl = coverImageAttachment ? getRenderableImageUrl(coverImageAttachment.type === "IMAGE" ? coverImageAttachment.url : coverImageAttachment.thumbnailUrl) : null;

    // --- Metadata Calculations ---
    const hasDescription = !!data.description;
    const hasAttachments = data.attachments?.length > (coverImageAttachment ? 1 : 0);
    const hasChecklists = data.checklists && data.checklists.length > 0;

    let checklistTotal = 0;
    let checklistCompleted = 0;
    if (hasChecklists) {
        data.checklists.forEach((list: any) => {
            checklistTotal += list.items.length;
            checklistCompleted += list.items.filter((item: any) => item.isCompleted).length;
        });
    }
    const isChecklistComplete = checklistTotal > 0 && checklistCompleted === checklistTotal;
    const hasLabels = data.labels && data.labels.length > 0;

    // Check if the due date is past due or due soon
    let isPastDue = false;
    let formattedDueDate = "";
    if (data.dueDate) {
        const date = new Date(data.dueDate);
        formattedDueDate = format(date, "MMM d");
        if (date < new Date()) isPastDue = true;
    }

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={{
                    ...style,
                    backgroundColor: data.color || "black",
                    color: data.fontColor || "white"
                }}
                className="opacity-30 border-2 border-neutral-500 truncate py-2 px-3 text-sm rounded-md shadow-sm"
            >
                {data.title}
            </div>
        );
    }

    return (
        <>
            <div
                ref={setNodeRef}
                style={{
                    ...style,
                    backgroundColor: data.color || "#111111",
                    color: data.fontColor || "white"
                }}
                {...attributes}
                {...listeners}
                role="button"
                onDoubleClick={() => setIsModalOpen(true)}
                onContextMenu={handleContextMenu}
                className="group border-2 border-transparent hover:border-neutral-500 text-sm hover:brightness-110 rounded-md shadow-sm flex flex-col overflow-hidden relative transition-all"
            >
                {renderableImageUrl && (
                    <div className="w-full relative flex items-center justify-center bg-black border-b border-neutral-800">
                        <img src={renderableImageUrl} alt="Card Cover" className="w-full h-auto max-h-[260px] object-cover" />
                    </div>
                )}

                <div className={`py-2 px-3 w-full flex flex-col gap-y-1.5 ${!renderableImageUrl ? "min-h-[36px]" : ""}`}>

                    {/* LABELS */}
                    {hasLabels && (
                        <div className="flex flex-wrap gap-1 mb-1">
                            {data.labels.map((label: any) => (
                                <div
                                    key={label.id}
                                    className="h-2 w-8 rounded-full"
                                    style={{ backgroundColor: label.color, opacity: 0.9 }}
                                    title={label.title}
                                />
                            ))}
                        </div>
                    )}

                    {/* TITLE */}
                    <div className="w-full font-medium break-words" style={{ color: data.fontColor || "white" }}>
                        {renderTitleWithLinks(data.title)}
                    </div>

                    {/* DESCRIPTION */}
                    {hasDescription && (
                        <div className="text-[11px] w-full break-words opacity-80 mt-0.5" style={{ color: data.fontColor || "white" }}>
                            {data.description.length > 100 ? data.description.substring(0, 100) + '...' : data.description}
                        </div>
                    )}

                    {/* METADATA FOOTER */}
                    {(hasDescription || hasChecklists || hasAttachments || data.dueDate) && (
                        <div
                            className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 opacity-75"
                            style={{ color: data.fontColor || "inherit" }}
                        >

                            {data.dueDate && (
                                <div className={`flex items-center gap-x-1 text-xs px-1.5 py-0.5 rounded-sm ${isPastDue ? 'bg-red-900/40 text-red-400' : 'bg-neutral-800'}`}>
                                    <Clock className="h-3 w-3" />
                                    <span>{formattedDueDate}</span>
                                </div>
                            )}

                            {hasDescription && (
                                <div className="flex items-center" title="This card has a description.">
                                    <AlignLeft className="h-3.5 w-3.5" />
                                </div>
                            )}

                            {hasChecklists && checklistTotal > 0 && (
                                <div className={`flex items-center gap-x-1.5 text-xs px-1.5 py-0.5 rounded-sm ${isChecklistComplete ? 'bg-green-900/40 text-green-400' : ''}`} title="Checklist items">
                                    <CheckSquare className="h-3 w-3" />
                                    <span>{checklistCompleted}/{checklistTotal}</span>
                                    <span className="opacity-70">({Math.round((checklistCompleted / checklistTotal) * 100)}%)</span>
                                </div>
                            )}

                            {hasAttachments && (
                                <div className="flex items-center gap-x-1 text-xs" title="Attachments">
                                    <Paperclip className="h-3 w-3" />
                                    <span>{data.attachments.length - (coverImageAttachment ? 1 : 0)}</span>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={handleMenuClose} onContextMenu={handleMenuClose} />
                    <div
                        className="fixed z-[70] bg-[#1a1a1a] border border-neutral-800 shadow-xl rounded-md py-1.5 w-48 text-sm text-neutral-200"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <span className="block px-3 py-1.5 text-xs font-semibold text-neutral-500 border-b border-neutral-800 mb-1 uppercase tracking-wider">Card Actions</span>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-red-500 font-medium">Delete Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Duplicate Card</button>
                        <div className="border-t border-neutral-800 my-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); onCopyCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Copy Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onPasteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Paste Card</button>
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
