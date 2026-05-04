"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CardModal } from "@/components/modals/card-modal/CardModal";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { deleteCard } from "@/actions/delete-card";
import { copyCard } from "@/actions/copy-card";
import { pasteCard } from "@/actions/paste-card";
import { cloneCard } from "@/actions/clone-card";
import { decloneCard } from "@/actions/declone-card";
import { updateCard } from "@/actions/update-card";
import { 
    AlignLeft, 
    CheckSquare, 
    Clock, 
    Paperclip, 
    MessageSquare, 
    ExternalLink, 
    ChevronUp, 
    ChevronDown, 
    Layers,
    MinusSquare,
    Maximize2,
    Copy,
    FileJson
} from "lucide-react";
import { format } from "date-fns";
import { detectFileType } from "@/lib/file-type-utils";
import { MiniAudioPlayer } from "@/components/ui/MiniAudioPlayer";
import { InstanceModal } from "@/components/modals/instance-modal";
import { formatImageUrl } from "@/lib/format-image-url";

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

const CardItemInner = ({ 
    data, 
    index, 
    boardId,
    onMoveCard,
    isFirstCard,
    isLastCard
}: { 
    data: any; 
    index: number; 
    boardId: string;
    onMoveCard?: (cardId: string, listId: string, action: 'up' | 'down' | 'position', newPosition?: number) => void;
    isFirstCard?: boolean;
    isLastCard?: boolean;
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [contextMenuAction, setContextMenuAction] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
    const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
    const [posValue, setPosValue] = useState((index + 1).toString());

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync posValue when index changes
    useEffect(() => {
        setPosValue((index + 1).toString());
    }, [index]);

    const onPosBlur = () => {
        const val = parseInt(posValue);
        if (!isNaN(val) && val !== index + 1) {
            onMoveCard?.(data.id, data.listId, 'position', val);
        } else {
            setPosValue((index + 1).toString());
        }
    };

    const onPosKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
            setPosValue((index + 1).toString());
            (e.target as HTMLInputElement).blur();
        }
    };

    const { execute: executeDeleteCard } = useSafeAction(deleteCard);
    const { execute: executeCopyCard } = useSafeAction(copyCard);
    const { execute: executePasteCard } = useSafeAction(pasteCard);
    const { execute: executeCloneCard } = useSafeAction(cloneCard);
    const { execute: executeDecloneCard } = useSafeAction(decloneCard);
    
    const { execute: executeUpdateCard } = useSafeAction(updateCard, {
        onSuccess: () => {
            // Success
        },
        onError: (error) => {
            console.error(error);
        }
    });

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

    const onCloneCard = () => {
        executeCloneCard({ id: data.id, boardId });
        handleMenuClose();
    };

    const onDecloneCard = () => {
        executeDecloneCard({ id: data.id, boardId });
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

    const onToggleSlim = () => {
        executeUpdateCard({
            id: data.id,
            boardId,
            isSlim: !data.isSlim
        });
        handleMenuClose();
    };

    const onCopyCardJson = async () => {
        const cardToExport = {
            title: data.title,
            description: data.description,
            color: data.color,
            fontColor: data.fontColor,
            isSlim: data.isSlim,
            displayThumbnails: data.displayThumbnails,
            dueDate: data.dueDate,
            labels: (data.labels || []).map((l: any) => ({ title: l.title, color: l.color })),
            attachments: (data.attachments || []).map((a: any) => ({ 
                url: a.url, 
                type: a.type, 
                title: a.title, 
                thumbnailUrl: a.thumbnailUrl, 
                isCover: a.isCover 
            })),
            checklists: (data.checklists || []).map((cl: any) => ({
                title: cl.title,
                items: (cl.items || []).map((i: any) => ({ title: i.title, isCompleted: i.isCompleted }))
            }))
        };

        try {
            const json = JSON.stringify(cardToExport, null, 2);
            await navigator.clipboard.writeText(json);
            // We use standard toast if available, or just rely on the user seeing it works
            // Assuming addToast is available via props or context in future, but for now just execute.
        } catch (err) {
            console.error("Failed to copy card JSON", err);
        }
        handleMenuClose();
    };

    const getRenderableImageUrl = (url: string) => {
        return formatImageUrl(url);
    };

    const coverIframeAttachment = data.attachments?.find((a: any) => a.isCover && a.type === "IFRAME");
    const renderableIframeUrl = coverIframeAttachment ? coverIframeAttachment.url : null;

    const coverImageAttachment = data.attachments?.find((a: any) => a.isCover && a.type !== "IFRAME")
        || data.attachments?.find((a: any) => a.type === "IMAGE" || a.thumbnailUrl);
    const renderableImageUrl = coverImageAttachment ? getRenderableImageUrl(coverImageAttachment.type === "IMAGE" ? coverImageAttachment.url : coverImageAttachment.thumbnailUrl) : null;

    const mapAttachment = data.attachments?.find((a: any) => 
        a.url.includes("google.com/maps") || 
        a.url.includes("maps.app.goo.gl") ||
        a.url.includes("goo.gl/maps")
    );
    const locationUrl = mapAttachment ? mapAttachment.url : null;

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
    const comments = data.activities ? data.activities.slice().reverse() : [];
    const hasComments = comments.length > 0;

    // First audio link attachment (if any)
    const audioAttachment = data.attachments?.find(
        (a: any) => a.type === "LINK" && detectFileType(a.url) === "audio"
    ) ?? null;

    // All non-audio LINK attachments (shown as clickable chips)
    const linkAttachments: any[] = (data.attachments ?? []).filter(
        (a: any) => a.type === "LINK" && detectFileType(a.url) !== "audio"
    );

    let isPastDue = false;
    let isDueSoon = false;
    let formattedDueDate = "";
    if (data.dueDate) {
        const date = new Date(data.dueDate);
        const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        formattedDueDate = format(utcDate, "MMM d");
        const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        const diffDays = Math.ceil((utcDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) isPastDue = true;
        else if (diffDays <= 3) isDueSoon = true;
    }

    let setLocationUrl = null;
    if (data.title?.trim().toUpperCase() === "SET LOCATION") {
        const descMatch = data.description?.match(/(https?:\/\/[^\s]+)/);
        if (descMatch) {
            setLocationUrl = descMatch[1];
        } else {
            const mapAttachment = data.attachments?.find((a: any) => (a.type === "IFRAME" || a.type === "LINK") && a.url?.includes("google.com/maps"));
            if (mapAttachment) {
                setLocationUrl = mapAttachment.url;
            } else {
                const anyLink = data.attachments?.find((a: any) => a.type === "IFRAME" || a.type === "LINK");
                if (anyLink) {
                    setLocationUrl = anyLink.url;
                }
            }
        }
    }

    return (
        <>
            <div
                style={{
                    backgroundColor: data.color ? data.color : "#ffffff",
                    color: data.fontColor ? data.fontColor : "#172b4d",
                }}
                role="button"
                onDoubleClick={() => setIsModalOpen(true)}
                onContextMenu={handleContextMenu}
                title={data.isSlim ? data.description : ""}
                className={`group border-2 border-transparent hover:border-neutral-500 text-sm hover:brightness-110 rounded-md shadow-sm flex flex-col relative transition-all ${data.isSlim ? "h-auto py-1 px-2" : ""}`}
            >
                {data.isSlim ? (
                    <div className="flex items-center gap-x-2 w-full min-w-0">
                        {hasLabels && (
                            <div className="flex gap-x-1 shrink-0">
                                {data.labels.map((label: any) => (
                                    <div 
                                        key={label.id} 
                                        className="h-2 w-3 rounded-[2px]" 
                                        style={{ backgroundColor: label.color }} 
                                        title={label.title} 
                                    />
                                ))}
                            </div>
                        )}
                        <div className="line-clamp-2 text-[11px] font-semibold leading-tight flex-1" style={{ color: data.fontColor || "#172b4d" }}>
                            {locationUrl ? (
                                <a
                                    href={locationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:opacity-80 transition"
                                    style={{ color: "#3b82f6" }}
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                >
                                    {data.title}
                                </a>
                            ) : (
                                data.title
                            )}
                        </div>
                        {data.syncGroupId && (
                            <span title="Instanced">
                                <Layers className="h-3 w-3 text-blue-500 shrink-0" />
                            </span>
                        )}
                        {hasAttachments && (
                            <Paperclip className="h-3 w-3 opacity-40 shrink-0" />
                        )}
                    </div>
                ) : (
                    <>

                        {/* Editable Rank Number Badge */}
                        <div className="absolute -right-3 -top-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input 
                                type="text"
                                value={posValue}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onChange={(e) => setPosValue(e.target.value)}
                                onBlur={onPosBlur}
                                onKeyDown={onPosKeyDown}
                                title="Enter position to move card"
                                className="w-10 h-7 bg-neutral-900 shadow-2xl text-white text-xs font-bold text-center border-2 border-white/70 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center p-0 hover:border-white transition-all"
                            />
                        </div>

                        <div className={`py-2 px-3 w-full flex flex-col gap-y-1.5 ${(!data.displayThumbnails || (!renderableImageUrl && !renderableIframeUrl)) ? "min-h-[36px]" : ""}`}>

                            {/* LABELS */}
                            {hasLabels && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {data.labels.map((label: any) => (
                                        <div
                                            key={label.id}
                                            className="h-4 px-2 rounded-[4px] text-[10px] font-semibold text-white/90 truncate max-w-full flex items-center"
                                            style={{ backgroundColor: label.color }}
                                            title={label.title}
                                        >
                                            {label.title}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TITLE */}
                            <div className="w-full font-medium break-words flex items-center gap-x-2" style={{ color: data.fontColor || "#172b4d" }}>
                                {data.syncGroupId && (
                                    <span title="Instanced">
                                        <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    </span>
                                )}
                                {data.displayThumbnails === false && hasAttachments && (
                                    <Paperclip className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                                )}
                                {locationUrl ? (
                                    <a
                                        href={locationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:opacity-80 transition"
                                        style={{ color: "#3b82f6" }}
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={(e) => e.stopPropagation()}
                                    >
                                        {data.title}
                                    </a>
                                ) : (
                                    renderTitleWithLinks(data.title)
                                )}
                            </div>

                            {/* MINI AUDIO PLAYER */}
                            {audioAttachment && (
                                <MiniAudioPlayer url={audioAttachment.url} title={audioAttachment.title} />
                            )}

                            {/* LINK CHIPS — clickable for any non-audio URL attachment */}
                            {linkAttachments.length > 0 && (
                                <div
                                    className="flex flex-col gap-y-1 mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    {linkAttachments.map((link: any) => (
                                        <a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="flex items-center gap-x-1.5 px-2 py-1 rounded-md bg-black/10 hover:bg-black/20 transition text-[11px] font-medium truncate group"
                                            style={{ color: data.fontColor || "#172b4d" }}
                                            title={link.url}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100" />
                                            <span className="truncate opacity-80 group-hover:opacity-100">
                                                {link.title || link.url}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* DESCRIPTION */}
                            {hasDescription && (
                                <div className="text-[11px] w-full break-words opacity-80 mt-0.5" style={{ color: data.fontColor || "#172b4d" }}>
                                    {data.description}
                                </div>
                            )}

                            {/* METADATA FOOTER */}
                            {(hasDescription || hasChecklists || hasAttachments || data.dueDate) && (
                                <div
                                    className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 opacity-75"
                                    style={{ color: data.fontColor || "inherit" }}
                                >

                                    {data.dueDate && (
                                        <div className={`flex items-center gap-x-1 text-xs px-1.5 py-0.5 rounded-sm ${isPastDue ? 'bg-red-500/20 text-red-700' : isDueSoon ? 'bg-yellow-500/20 text-yellow-700' : 'bg-neutral-200 text-neutral-600'}`}>
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

                                    {hasComments && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsCommentsExpanded(!isCommentsExpanded); }}
                                            className="flex items-center gap-x-1 text-xs hover:bg-black/10 px-1.5 py-0.5 rounded-sm transition"
                                            title="Comments"
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            <span>{comments.length}</span>
                                        </button>
                                    )}

                                </div>
                            )}

                            {/* EXPANDABLE COMMENTS */}
                            {isCommentsExpanded && hasComments && (
                                <div className="mt-2 pt-2 border-t border-black/10 flex flex-col gap-y-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    {comments.map((comment: any) => (
                                        <div key={comment.id} className="text-xs bg-black/5 rounded-sm p-1.5 shadow-sm">
                                            <div className="font-semibold mb-0.5 opacity-90" style={{ color: data.fontColor || "inherit" }}>
                                                {comment.userId === "user" ? "User" : comment.userId}
                                            </div>
                                            <div className="break-words opacity-80" style={{ color: data.fontColor || "inherit" }}>
                                                {comment.action}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {data.displayThumbnails !== false && renderableImageUrl && !renderableIframeUrl && (
                            <div className="w-full relative flex items-center justify-center bg-black border-t border-neutral-800 overflow-hidden rounded-b-md">
                                <img 
                                    src={renderableImageUrl} 
                                    alt="Card Cover" 
                                    loading="lazy"
                                    className="w-full h-auto max-h-[260px] object-cover object-center" 
                                />
                            </div>
                        )}

                        {data.displayThumbnails !== false && renderableIframeUrl && (
                            <div className="w-full relative flex items-center justify-center bg-neutral-200 border-t border-neutral-300 overflow-hidden rounded-b-md pointer-events-none">
                                <iframe src={renderableIframeUrl} className="w-full h-[180px] border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {contextMenu && mounted && createPortal(
                <div style={{ pointerEvents: 'auto' }}>
                    <div className="fixed inset-0 z-[60]" onClick={handleMenuClose} onContextMenu={handleMenuClose} />
                    <div
                        className="fixed z-[70] bg-[#1a1a1a] border border-neutral-800 shadow-xl rounded-md py-1.5 w-48 text-sm text-neutral-200"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <span className="block px-3 py-1.5 text-xs font-semibold text-neutral-500 border-b border-neutral-800 mb-1 uppercase tracking-wider">Card Actions</span>
                        <button onClick={(e) => { e.stopPropagation(); setContextMenuAction('move'); handleMenuClose(); setIsModalOpen(true); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-blue-400 font-medium">Move Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-red-500 font-medium">Delete Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Duplicate Card</button>
                        <button onClick={(e) => { e.stopPropagation(); setIsInstanceModalOpen(true); handleMenuClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-blue-400 font-medium">Instance Card</button>
                        {data.syncGroupId && (
                            <button onClick={(e) => { e.stopPropagation(); onDecloneCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-yellow-500">Make Unique</button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onToggleSlim(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition flex items-center gap-x-2">
                            {data.isSlim ? <Maximize2 className="h-4 w-4" /> : <MinusSquare className="h-4 w-4" />}
                            {data.isSlim ? "Exit Slim Mode" : "Slim Mode"}
                        </button>
                        <div className="border-t border-neutral-800 my-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); onCopyCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Copy Card</button>
                        <button onClick={(e) => { e.stopPropagation(); onCopyCardJson(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition flex items-center gap-x-2 text-purple-400">
                            <FileJson className="h-3.5 w-3.5" />
                            Copy Card (JSON)
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onPasteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Paste Card</button>
                    </div>
                </div>,
                document.body
            )}

            {isModalOpen && (
                <CardModal
                    data={data}
                    boardId={boardId}
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setContextMenuAction(null); }}
                    defaultMoveOpen={contextMenuAction === 'move'}
                    index={index}
                    onMoveCard={onMoveCard}
                />
            )}

            {isInstanceModalOpen && (
                <InstanceModal
                    card={data}
                    boardId={boardId}
                    isOpen={isInstanceModalOpen}
                    onClose={() => setIsInstanceModalOpen(false)}
                />
            )}
        </>
    );
};

export const CardItem = React.memo(CardItemInner);
