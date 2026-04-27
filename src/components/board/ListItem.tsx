"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CardItem } from "./CardItem";
import { useState, useRef, ElementRef, KeyboardEventHandler, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useEventListener, useOnClickOutside } from "usehooks-ts";
import { Palette, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "@/hooks/use-action";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateBoard } from "@/actions/update-board";
import { updateList } from "@/actions/update-list";
import { createCard } from "@/actions/create-card";
import { deleteList } from "@/actions/delete-list";
import { copyList } from "@/actions/copy-list";
import { pasteList } from "@/actions/paste-list";
import { pasteCard } from "@/actions/paste-card";

export const ListItem = ({
    data,
    index,
    searchQuery = "",
    searchCards = true,
    searchLists = true,
    listColorSwatches,
    textColorSwatches
}: {
    data: any;
    index: number;
    searchQuery?: string;
    searchCards?: boolean;
    searchLists?: boolean;
    listColorSwatches?: string[];
    textColorSwatches?: string[];
    onMoveList?: (listId: string, direction: 'left' | 'right') => void;
    isFirst?: boolean;
    isLast?: boolean;
}) => {
    const [title, setTitle] = useState(data.title);
    const [isEditing, setIsEditing] = useState(false);
    const formRef = useRef<ElementRef<"form">>(null);
    const inputRef = useRef<ElementRef<"input">>(null);

    // Sync local title state whenever the server data changes
    useEffect(() => {
        setTitle(data.title);
    }, [data.title]);

    const [isEditingCard, setIsEditingCard] = useState(false);
    const cardFormRef = useRef<ElementRef<"form">>(null);
    const cardInputRef = useRef<ElementRef<"textarea">>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [colorPickerTab, setColorPickerTab] = useState<"bg" | "text">("bg");
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    const resizeStartY = useRef(0);
    const resizeStartHeight = useRef(600);
    const router = useRouter();

    const listHeightKey = `board_list_height_${data.boardId}`;

    const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const currentHeight = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue("--list-max-height") || "600",
            10
        );
        resizeStartY.current = e.clientY;
        resizeStartHeight.current = currentHeight;
        setIsResizing(true);

        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientY - resizeStartY.current;
            const newHeight = Math.max(200, resizeStartHeight.current + delta);
            document.documentElement.style.setProperty("--list-max-height", `${newHeight}px`);
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            const delta = upEvent.clientY - resizeStartY.current;
            const newHeight = Math.max(200, resizeStartHeight.current + delta);
            document.documentElement.style.setProperty("--list-max-height", `${newHeight}px`);
            localStorage.setItem(listHeightKey, String(newHeight));
            setIsResizing(false);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [listHeightKey]);

    const LIST_COLORS = [
        "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80",
        "#22d3ee", "#60a5fa", "#818cf8", "#c084fc", "#f472b6",
        "#1e293b", "#334155", "#0f172a", "#18181b", "#27272a"
    ];

    const TEXT_COLORS = [
        "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1",
        "#000000", "#0f172a", "#1e293b", "#334155", "#475569"
    ];

    const [currentListColors, setCurrentListColors] = useState(listColorSwatches?.length ? listColorSwatches : LIST_COLORS);
    const [currentTextColors, setCurrentTextColors] = useState(textColorSwatches?.length ? textColorSwatches : TEXT_COLORS);

    const [editingSwatch, setEditingSwatch] = useState<{ type: 'list' | 'text', index: number } | null>(null);
    const colorInputRef = useRef<HTMLInputElement>(null);

    const { execute: executeUpdateBoard } = useAction(updateBoard, {
        onError: (error) => console.error(error)
    });

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingSwatch) return;
        const newColor = e.target.value;
        if (editingSwatch.type === 'list') {
            const newColors = [...currentListColors];
            newColors[editingSwatch.index] = newColor;
            setCurrentListColors(newColors);
            executeUpdateBoard({ id: data.boardId, listColorSwatches: newColors });
        } else {
            const newColors = [...currentTextColors];
            newColors[editingSwatch.index] = newColor;
            setCurrentTextColors(newColors);
            executeUpdateBoard({ id: data.boardId, textColorSwatches: newColors });
        }
    };

    const handleContextMenuColor = (e: React.MouseEvent, type: 'list' | 'text', index: number) => {
        e.preventDefault();
        setEditingSwatch({ type, index });
        setTimeout(() => {
            colorInputRef.current?.click();
        }, 50);
    };

    const { execute: executeUpdateList, isExecuting: isLoading } = useSafeAction(updateList, {
        onSuccess: () => {
            disableEditing();
            router.refresh();
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeCreateCard, isLoading: isCardLoading } = useAction(createCard, {
        onSuccess: () => {
            disableCardEditing();
            router.refresh();
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeDeleteList } = useAction(deleteList, { onSuccess: () => router.refresh() });
    const { execute: executeCopyList } = useAction(copyList, { onSuccess: () => router.refresh() });
    const { execute: executePasteList } = useAction(pasteList, { onSuccess: () => router.refresh() });
    const { execute: executePasteCard } = useAction(pasteCard, { onSuccess: () => router.refresh() });

    const enableEditing = () => {
        setIsEditing(true);
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
    };

    const disableEditing = () => {
        setIsEditing(false);
    };

    const enableCardEditing = () => {
        setIsEditingCard(true);
        setTimeout(() => {
            cardInputRef.current?.focus();
        });
    };

    const disableCardEditing = () => {
        setIsEditingCard(false);
        if (cardInputRef.current) cardInputRef.current.value = "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            disableEditing();
            disableCardEditing();
        }
    };

    useEventListener("keydown", onKeyDown);
    useOnClickOutside(formRef as React.RefObject<HTMLElement>, disableEditing);
    useOnClickOutside(cardFormRef as React.RefObject<HTMLElement>, disableCardEditing);

    const onTextareaKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            cardFormRef.current?.requestSubmit();
        }
    };

    useEventListener("paste", (e: ClipboardEvent) => {
        if (!isHovered) return;

        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
            return;
        }

        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const text = clipboardData.getData("text");
        if (text) {
            try {
                // Check if it's an iframe embed
                const iframeMatch = text.match(/<iframe.*?src=["'](.*?)["']/);
                if (iframeMatch && iframeMatch[1]) {
                    executeCreateCard({ title: "Embedded Map", boardId: data.boardId, listId: data.id, iframeUrl: iframeMatch[1] });
                    return;
                }

                // Check if it's a URL
                new URL(text);
                executeCreateCard({ title: "Pasted Image", boardId: data.boardId, listId: data.id, imageUrl: text });
            } catch {
                // Not a valid URL, just create a text card
                executeCreateCard({ title: text.slice(0, 100), boardId: data.boardId, listId: data.id });
            }
        }
    });

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newTitle = formData.get("title") as string;

        if (!newTitle || !newTitle.trim()) {
            return disableEditing();
        }

        if (newTitle.trim() === title) {
            return disableEditing();
        }

        // Optimistically set title in local state so it doesn't flicker
        setTitle(newTitle.trim());
        executeUpdateList({ title: newTitle.trim(), id: data.id, boardId: data.boardId });
    };

    const onBgColorSelect = (color: string) => {
        setIsColorPickerOpen(false);
        executeUpdateList({ title: data.title, id: data.id, boardId: data.boardId, color });
    };

    const onTextColorSelect = (color: string) => {
        setIsColorPickerOpen(false);
        executeUpdateList({ title: data.title, id: data.id, boardId: data.boardId, fontColor: color });
    };

    const onCardSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;

        if (!title.trim()) return;

        executeCreateCard({ title: title.trim(), boardId: data.boardId, listId: data.id });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleMenuClose = () => {
        setContextMenu(null);
    };

    const onDeleteList = () => {
        executeDeleteList({ id: data.id, boardId: data.boardId });
        handleMenuClose();
    };

    const onDuplicateList = () => {
        executeCopyList({ id: data.id, boardId: data.boardId });
        handleMenuClose();
    };

    const onCopyList = () => {
        localStorage.setItem("trello_clipboard_list", data.id);
        handleMenuClose();
    };

    const onPasteList = () => {
        const clipboardListId = localStorage.getItem("trello_clipboard_list");
        if (clipboardListId) {
            executePasteList({ sourceListId: clipboardListId, boardId: data.boardId });
        }
        handleMenuClose();
    };

    const onPasteCard = () => {
        const clipboardCardId = localStorage.getItem("trello_clipboard_card");
        if (clipboardCardId) {
            executePasteCard({ sourceCardId: clipboardCardId, targetListId: data.id, boardId: data.boardId });
        }
        handleMenuClose();
    };

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: data.id,
        data: {
            type: "List",
            list: data,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const isListMatched = searchLists && searchQuery && title.toLowerCase().includes(searchQuery.toLowerCase());
    const isListMismatched = searchQuery && !isListMatched && searchLists;
    const isListMatch = !searchQuery.trim() || (searchLists && data.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const hasMatchingCards = !searchQuery.trim() || (searchCards && data.cards?.some((card: any) =>
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()))
    ));
    const showList = isListMatch || hasMatchingCards;

    const renderTitle = (text: string) => {
        if (text.includes("[AUTO]")) {
            const parts = text.split("[AUTO]");
            return (
                <div className="flex items-center gap-x-1 truncate">
                    <span className="text-red-500 font-bold shrink-0">{parts[0].trim()}</span>
                    <span className="truncate">{parts[1]}</span>
                </div>
            );
        }
        return <span className="truncate">{text}</span>;
    };

    return (
        <li
            ref={setNodeRef}
            style={{ ...style, display: showList ? 'block' : 'none' }}
            {...attributes}
            className={`shrink-0 h-full w-[272px] select-none ${isDragging ? "opacity-30" : ""}`}
        >
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-full rounded-md text-black shadow-md pb-2 relative transition-colors flex flex-col"
                style={{ backgroundColor: data.color ? data.color : '#f1f2f4', maxHeight: 'var(--list-max-height)' }}
            >
                {/* List Header */}
                <div
                    {...listeners}
                    onContextMenu={handleContextMenu}
                    className="pt-2 px-3 pb-1 text-sm font-semibold flex justify-between items-center gap-x-2 rounded-t-md cursor-grab active:cursor-grabbing"
                >
                    {isEditing ? (
                        <form ref={formRef} onSubmit={onSubmit} className="flex-1 px-[2px]">
                            <input
                                ref={inputRef}
                                name="title"
                                id="title"
                                defaultValue={title}
                                className="text-sm px-[7px] py-1 h-7 font-medium border-transparent hover:border-input focus:border-input transition truncate bg-transparent focus:bg-white focus:text-black w-full"
                                style={{ color: data.fontColor ? data.fontColor : 'inherit' }}
                                placeholder="Enter list title..."
                            />
                            <button type="submit" hidden disabled={isLoading} />
                        </form>
                    ) : (
                        <div
                            onClick={enableEditing}
                            className={`w-full text-sm px-2.5 py-1 h-7 font-medium border-transparent cursor-pointer flex items-center gap-x-2 overflow-hidden`}
                            style={{ color: data.fontColor ? data.fontColor : (data.color ? 'white' : 'black') }}
                        >
                            {renderTitle(title)}
                            <span className={`ml-auto text-[10px] font-normal px-1.5 py-0.5 rounded-full shrink-0 ${data.color ? 'bg-white/20' : 'bg-neutral-300/60'}`}>{data.cards?.length || 0}</span>
                        </div>
                    )}

                    <button
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        className={`p-1.5 rounded-sm hover:bg-black/10 transition ${data.color ? 'text-white' : 'text-neutral-500'}`}
                    >
                        <Palette className="h-4 w-4" />
                    </button>
                </div>

                {isColorPickerOpen && (
                    <div className="absolute top-10 right-2 w-56 bg-white rounded-md shadow-lg border p-3 z-10 cursor-default">
                        <div className="flex items-center justify-between mb-2 cursor-default">
                            <span className="font-semibold text-xs text-neutral-600">Appearance</span>
                            <button onClick={() => setIsColorPickerOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-0.5 rounded-sm">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="flex items-center gap-x-2 mb-3 border-b text-xs pb-1 font-medium">
                            <button
                                onClick={(e) => { e.stopPropagation(); setColorPickerTab("bg"); }}
                                className={`px-2 py-0.5 rounded-sm ${colorPickerTab === "bg" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
                            >Background</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setColorPickerTab("text"); }}
                                className={`px-2 py-0.5 rounded-sm ${colorPickerTab === "text" ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:text-neutral-700"}`}
                            >Text</button>
                        </div>

                        {colorPickerTab === "bg" && (
                            <div>
                                <div className="grid grid-cols-5 gap-1.5 cursor-default">
                                    {currentListColors.map((color, idx) => (
                                        <button
                                            key={`list-${idx}`}
                                            className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10"
                                            style={{ backgroundColor: color }}
                                            onClick={(e) => { e.stopPropagation(); onBgColorSelect(color); }}
                                            onContextMenu={(e) => handleContextMenuColor(e, 'list', idx)}
                                        />
                                    ))}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onBgColorSelect(""); }}
                                        className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10 bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-medium"
                                    >
                                        none
                                    </button>
                                </div>
                            </div>
                        )}

                        {colorPickerTab === "text" && (
                            <div>
                                <div className="grid grid-cols-5 gap-1.5 cursor-default">
                                    {currentTextColors.map((color, idx) => (
                                        <button
                                            key={`text-${idx}`}
                                            className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/20"
                                            style={{ backgroundColor: color }}
                                            onClick={(e) => { e.stopPropagation(); onTextColorSelect(color); }}
                                            onContextMenu={(e) => handleContextMenuColor(e, 'text', idx)}
                                        />
                                    ))}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTextColorSelect(""); }}
                                        className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10 bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-medium"
                                    >
                                        auto
                                    </button>
                                </div>
                                <div className="mt-3 pt-2 border-t flex items-center gap-x-2">
                                    <label className="text-[10px] text-neutral-500 font-medium">Custom:</label>
                                    <input
                                        id="text-color-picker"
                                        type="color"
                                        defaultValue={data.fontColor || "#ffffff"}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-7 w-10 rounded cursor-pointer border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const input = document.getElementById('text-color-picker') as HTMLInputElement;
                                            if (input) onTextColorSelect(input.value);
                                        }}
                                        className="text-[10px] font-medium bg-blue-600 text-white px-2 py-1 rounded-sm hover:bg-blue-700 transition"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {contextMenu && mounted && createPortal(
                    <div style={{ pointerEvents: 'auto' }}>
                        <div className="fixed inset-0 z-[60]" onClick={handleMenuClose} onContextMenu={(e) => { e.preventDefault(); handleMenuClose(); }} />
                        <div
                            className="fixed z-[70] bg-[#1a1a1a] border border-neutral-800 shadow-xl rounded-md py-1.5 w-48 text-sm text-neutral-200"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                        >
                            <span className="block px-3 py-1.5 text-xs font-semibold text-neutral-500 border-b border-neutral-800 mb-1 uppercase tracking-wider">List Actions</span>
                            {!isFirst && onMoveList && (
                                <button onClick={(e) => { e.stopPropagation(); onMoveList(data.id, 'left'); handleMenuClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-blue-400 font-medium">Move List Left</button>
                            )}
                            {!isLast && onMoveList && (
                                <button onClick={(e) => { e.stopPropagation(); onMoveList(data.id, 'right'); handleMenuClose(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-blue-400 font-medium">Move List Right</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onDeleteList(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition text-red-500 font-medium">Delete List</button>
                            <button onClick={(e) => { e.stopPropagation(); onDuplicateList(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Duplicate List</button>
                            <div className="border-t border-neutral-800 my-1"></div>
                            <button onClick={(e) => { e.stopPropagation(); onCopyList(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Copy List</button>
                            <button onClick={(e) => { e.stopPropagation(); onPasteList(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Paste List</button>
                            <button onClick={(e) => { e.stopPropagation(); onPasteCard(); }} className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition">Paste Card Here</button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Cards Wrapper */}
                <SortableContext
                    items={data.cards.map((c: any) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2 mt-2 min-h-[2px] flex-1 overflow-y-scroll">
                        {data.cards.map((card: any, idx: number) => {
                            const matchesCardSearch = !searchQuery.trim() || isListMatch || (searchCards && (
                                card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            ));
                            return (
                                <div key={card.id} style={{ display: matchesCardSearch ? 'block' : 'none' }}>
                                    <CardItem index={idx} data={card} boardId={data.boardId} />
                                </div>
                            );
                        })}
                    </ol>
                </SortableContext>
                {/* Add Card Button or Form */}
                <div className="pt-2 px-2 pb-2">
                    {isEditingCard ? (
                        <form ref={cardFormRef} onSubmit={onCardSubmit} className="space-y-2">
                            <textarea
                                ref={cardInputRef}
                                onKeyDown={onTextareaKeyDown}
                                name="title"
                                id="title"
                                className="text-sm px-2 py-2 font-medium w-full resize-none border-transparent hover:border-input focus:border-input transition bg-white rounded-md shadow-sm outline-none"
                                placeholder="Enter a title for this card..."
                            />
                            <div className="flex items-center gap-x-1">
                                <button type="submit" disabled={isCardLoading} className="bg-blue-600 text-white hover:bg-blue-700 transition px-3 py-1.5 rounded-md text-sm font-medium">Add card</button>
                                <button type="button" onClick={disableCardEditing} className="px-2 py-1.5 text-sm hover:bg-black/5 rounded-md">Cancel</button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={enableCardEditing}
                            className={`h-auto px-2 py-1.5 w-full justify-start text-sm flex items-center hover:bg-black/10 rounded-md transition cursor-pointer ${data.color ? 'text-white/80 hover:text-white' : 'text-muted-foreground'}`}
                        >
                            + Add a card
                        </button>
                    )}
                </div>

                {/* Resize Handle */}
                <div
                    onMouseDown={onResizeMouseDown}
                    className={`w-full h-3 flex items-center justify-center cursor-ns-resize group rounded-b-md transition-colors ${isResizing ? 'bg-blue-500/40' : 'hover:bg-black/20'}`}
                    title="Drag to resize all lists"
                >
                    <div className={`w-8 h-0.5 rounded-full transition-colors ${isResizing ? 'bg-blue-400' : 'bg-black/20 group-hover:bg-white/60'}`} />
                </div>
            </div>
        </li>
    );
};
