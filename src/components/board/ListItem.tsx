"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CardItem } from "./CardItem";
import { useState, useRef, ElementRef, KeyboardEventHandler } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";
import { Palette, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "@/hooks/use-action";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateList } from "@/actions/update-list";
import { createCard } from "@/actions/create-card";
import { deleteList } from "@/actions/delete-list";
import { copyList } from "@/actions/copy-list";
import { pasteList } from "@/actions/paste-list";
import { pasteCard } from "@/actions/paste-card";

export const ListItem = ({ data, index, searchQuery = "" }: { data: any; index: number; searchQuery?: string }) => {
    const [title, setTitle] = useState(data.title);
    const [isEditing, setIsEditing] = useState(false);
    const formRef = useRef<ElementRef<"form">>(null);
    const inputRef = useRef<ElementRef<"input">>(null);

    const [isEditingCard, setIsEditingCard] = useState(false);
    const cardFormRef = useRef<ElementRef<"form">>(null);
    const cardInputRef = useRef<ElementRef<"textarea">>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [colorPickerTab, setColorPickerTab] = useState<"bg" | "text">("bg");
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const router = useRouter();

    const LIST_COLORS = [
        "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80",
        "#22d3ee", "#60a5fa", "#818cf8", "#c084fc", "#f472b6",
        "#1e293b", "#334155", "#0f172a", "#18181b", "#27272a"
    ];

    const TEXT_COLORS = [
        "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1",
        "#000000", "#0f172a", "#1e293b", "#334155", "#475569"
    ];

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

        if (newTitle === data.title || !newTitle) {
            return disableEditing();
        }

        executeUpdateList({ title: newTitle, id: data.id, boardId: data.boardId });
    };

    const onBgColorSelect = (color: string) => {
        executeUpdateList({ title: data.title, id: data.id, boardId: data.boardId, color });
    };

    const onTextColorSelect = (color: string) => {
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

    return (
        <li
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`shrink-0 h-full w-[272px] select-none ${isDragging ? "opacity-30" : ""}`}
        >
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-full rounded-md text-black shadow-md pb-2 relative transition-colors flex flex-col"
                style={{ backgroundColor: data.color ? data.color : '#f1f2f4', maxHeight: '600px' }}
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
                            className={`w-full text-sm px-2.5 py-1 h-7 font-medium border-transparent cursor-pointer flex items-center gap-x-2`}
                            style={{ color: data.fontColor ? data.fontColor : (data.color ? 'white' : 'black') }}
                        >
                            {title}
                            <span className={`ml-auto text-[10px] font-normal px-1.5 py-0.5 rounded-full ${data.color ? 'bg-white/20' : 'bg-neutral-300/60'}`}>{data.cards?.length || 0}</span>
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
                                    {LIST_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={(e) => { e.stopPropagation(); onBgColorSelect(color); }}
                                            className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onBgColorSelect(""); }}
                                        className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10 bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-medium"
                                    >
                                        none
                                    </button>
                                </div>
                                <div className="mt-3 pt-2 border-t flex items-center gap-x-2">
                                    <label className="text-[10px] text-neutral-500 font-medium">Custom:</label>
                                    <input
                                        id="bg-color-picker"
                                        type="color"
                                        defaultValue={data.color || "#3b82f6"}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-7 w-10 rounded cursor-pointer border-0 p-0 bg-transparent"
                                    />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const input = document.getElementById('bg-color-picker') as HTMLInputElement;
                                            if (input) onBgColorSelect(input.value);
                                        }}
                                        className="text-[10px] font-medium bg-blue-600 text-white px-2 py-1 rounded-sm hover:bg-blue-700 transition"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}

                        {colorPickerTab === "text" && (
                            <div>
                                <div className="grid grid-cols-5 gap-1.5 cursor-default">
                                    {TEXT_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={(e) => { e.stopPropagation(); onTextColorSelect(color); }}
                                            className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/20"
                                            style={{ backgroundColor: color }}
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

                {contextMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={handleMenuClose} onContextMenu={(e) => { e.preventDefault(); handleMenuClose(); }} />
                        <div
                            className="fixed z-50 bg-white border border-neutral-200 shadow-xl rounded-md py-1.5 w-48 text-sm text-neutral-800"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                        >
                            <span className="block px-3 py-1.5 text-xs font-semibold text-neutral-500 border-b mb-1 uppercase tracking-wider">List Actions</span>
                            <button onClick={onDeleteList} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition text-red-600 font-medium">Delete List</button>
                            <button onClick={onDuplicateList} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Duplicate List</button>
                            <div className="border-t my-1"></div>
                            <button onClick={onCopyList} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Copy List</button>
                            <button onClick={onPasteList} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Paste List</button>
                            <button onClick={onPasteCard} className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 transition">Paste Card Here</button>
                        </div>
                    </>
                )}

                {/* Cards Wrapper */}
                <SortableContext
                    items={data.cards.map((c: any) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="mx-1 px-1 py-2 flex flex-col gap-y-2 mt-2 min-h-[2px] flex-1 overflow-y-scroll">
                        {data.cards.map((card: any, idx: number) => {
                            const matchesSearch = !searchQuery.trim() ||
                                card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()));
                            return (
                                <div key={card.id} style={{ display: matchesSearch ? 'block' : 'none' }}>
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
            </div>
        </li>
    );
};
