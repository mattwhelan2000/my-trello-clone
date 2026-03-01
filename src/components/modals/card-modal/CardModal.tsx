"use client";

import { Modal } from "@/components/modals/Modal";
import { AlignLeft, Layout, CheckSquare, Clock, Paperclip, Activity, X } from "lucide-react";
import { useState, useRef, ElementRef, useEffect } from "react";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { createAttachment } from "@/actions/create-attachment";
import { createChecklist } from "@/actions/create-checklist";
import { updateAttachmentCover } from "@/actions/update-attachment-cover";
import { deleteAttachment } from "@/actions/delete-attachment";
import { createLabel } from "@/actions/create-label";
import { deleteLabel } from "@/actions/delete-label";
import { Description } from "./description";
import { Checklist } from "./checklist";
import Image from "next/image";

interface CardModalProps {
    data: any;
    boardId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const CardModal = ({ data, boardId, isOpen, onClose }: CardModalProps) => {
    const [title, setTitle] = useState(data?.title || "");
    const [isAddingImage, setIsAddingImage] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [newLabelTitle, setNewLabelTitle] = useState("");
    const [colorPickerTab, setColorPickerTab] = useState<"bg" | "text">("bg");
    const inputRef = useRef<ElementRef<"input">>(null);
    const imageInputRef = useRef<ElementRef<"input">>(null);

    const { execute: executeUpdateCard } = useAction(updateCard, {
        onSuccess: (responseData: any) => {
            setTitle(responseData.title || title);
            inputRef.current?.blur();
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeCreateChecklist } = useAction(createChecklist, {
        onSuccess: (responseData: any) => {
            // Checklist created
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeCreateAttachment, isLoading: isAttachmentLoading } = useAction(createAttachment, {
        onSuccess: (responseData: any) => {
            setIsAddingImage(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeUpdateAttachmentCover } = useAction(updateAttachmentCover, {
        onSuccess: () => {
            // Cover updated successfully
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeDeleteAttachment } = useAction(deleteAttachment, {
        onSuccess: () => { },
        onError: (error) => console.error(error)
    });

    const { execute: executeCreateLabel } = useAction(createLabel, {
        onSuccess: () => {
            setIsLabelPickerOpen(false);
            setNewLabelTitle("");
        },
        onError: (error) => console.error(error)
    });

    const { execute: executeDeleteLabel } = useAction(deleteLabel, {
        onSuccess: () => { },
        onError: (error) => console.error(error)
    });

    const onAddChecklist = () => {
        executeCreateChecklist({ title: "Checklist", cardId: data.id, boardId });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const url = formData.get("url") as string;

        if (!url.trim()) return;

        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) || url.includes("dropbox.com");
        const type = isImage ? "IMAGE" : "LINK";

        executeCreateAttachment({ id: data.id, boardId, url: url.trim(), type });
    };

    const onBlur = () => {
        inputRef.current?.form?.requestSubmit();
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newTitle = formData.get("title") as string;

        if (newTitle === data.title || !newTitle) return;

        // We assume data object contains list's boardId or we can get it from params,
        // assuming data mock here has boardId or we just pass it down if needed.
        executeUpdateCard({ title: newTitle, id: data.id, boardId });
    };

    // Helper to format Dropbox links appropriately for rendering
    const getRenderableImageUrl = (url: string) => {
        if (!url) return null;
        if (url.includes("dropbox.com") && url.includes("dl=0")) {
            return url.replace("dl=0", "raw=1");
        }
        return url;
    };

    const CARD_COLORS = [
        "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80",
        "#22d3ee", "#60a5fa", "#818cf8", "#c084fc", "#f472b6",
        "#1e293b", "#334155", "#0f172a", "#18181b", "#27272a"
    ];

    const TEXT_COLORS = [
        "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1",
        "#000000", "#0f172a", "#1e293b", "#334155", "#475569"
    ];

    const [optimisticColor, setOptimisticColor] = useState(data.color);
    const [optimisticFontColor, setOptimisticFontColor] = useState(data.fontColor);
    const [optimisticDueDate, setOptimisticDueDate] = useState(data.dueDate);

    useEffect(() => {
        setOptimisticColor(data.color);
        setOptimisticFontColor(data.fontColor);
        setOptimisticDueDate(data.dueDate);
    }, [data.color, data.fontColor, data.dueDate]);

    const onBgColorSelect = (color: string) => {
        setOptimisticColor(color);
        executeUpdateCard({ title: data.title, id: data.id, boardId, color });
    };

    const onTextColorSelect = (color: string) => {
        setOptimisticFontColor(color);
        executeUpdateCard({ title: data.title, id: data.id, boardId, fontColor: color });
    };

    if (!data) return null;

    const imageAttachments = data.attachments?.filter((a: any) => a.type === "IMAGE") || [];
    const linkAttachments = data.attachments?.filter((a: any) => a.type === "LINK") || [];

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            {!imageAttachments.length && optimisticColor && (
                <div className="w-full h-24 rounded-t-xl" style={{ backgroundColor: optimisticColor }} />
            )}
            {imageAttachments.length > 0 && (
                <div className="flex flex-col gap-y-4 pt-4 px-4 bg-neutral-100/50 pb-4 first:rounded-t-lg">
                    {imageAttachments.map((attachment: any) => {
                        const renderableImageUrl = getRenderableImageUrl(attachment.url);
                        if (!renderableImageUrl) return null;
                        return (
                            <div key={attachment.id} className="w-full flex flex-col gap-y-2">
                                <div className="w-full relative bg-neutral-200 flex items-center justify-center overflow-hidden shadow-sm rounded-md group">
                                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex justify-center">
                                        <img
                                            src={renderableImageUrl}
                                            alt="Card Attachment"
                                            className="w-full h-auto object-cover max-h-[300px]"
                                        />
                                    </a>
                                    {attachment.isCover && (
                                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-sm flex items-center gap-x-1 backdrop-blur-sm">
                                            <Layout className="w-3 h-3" /> Cover
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-x-2 px-1">
                                    {!attachment.isCover ? (
                                        <button
                                            onClick={() => executeUpdateAttachmentCover({ id: attachment.id, cardId: data.id, boardId })}
                                            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-200 hover:bg-neutral-300 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1"
                                        >
                                            <Layout className="w-3 h-3" /> Make Cover
                                        </button>
                                    ) : (
                                        <button className="text-xs font-medium text-white bg-blue-600 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1 cursor-default">
                                            <CheckSquare className="w-3 h-3" /> Current Cover
                                        </button>
                                    )}
                                    <button
                                        onClick={() => executeDeleteAttachment({ id: attachment.id, boardId })}
                                        className="text-xs font-medium text-red-600 hover:text-red-700 bg-neutral-200 hover:bg-neutral-300 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1 ml-auto"
                                    >
                                        <X className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            <div className={`p-6 ${imageAttachments.length > 0 ? 'pt-4 border-t' : ''}`}>
                {/* Labels Header */}
                {data.labels && data.labels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 ml-10">
                        {data.labels.map((label: any) => (
                            <div key={label.id} className="relative group">
                                <span className="px-3 py-1 rounded-sm text-xs font-semibold text-white/90" style={{ backgroundColor: label.color }}>
                                    {label.title}
                                </span>
                                <button
                                    onClick={(e) => { e.preventDefault(); executeDeleteLabel({ id: label.id, boardId }); }}
                                    className="absolute -top-2 -right-2 bg-neutral-800 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm h-4 w-4 flex items-center justify-center"
                                    title="Remove label"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Header */}
                <div className="flex items-start gap-x-3 w-full mb-8">
                    <Layout className="h-6 w-6 text-neutral-700 mt-1" />
                    <div className="w-full">
                        <form onSubmit={onSubmit}>
                            <input
                                ref={inputRef}
                                name="title"
                                defaultValue={title}
                                onBlur={onBlur}
                                style={{ color: optimisticFontColor || undefined }}
                                className="font-semibold text-xl text-neutral-700 px-1 border-transparent hover:border-input focus:border-input transition bg-transparent focus:bg-white w-[95%]"
                            />
                        </form>
                        <p className="text-sm text-neutral-500 mt-1 px-1">in list <span className="underline">Current List</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 md:gap-4">
                    <div className="col-span-3 space-y-8">
                        {/* Description Area */}
                        <Description data={data} boardId={boardId} />

                        {/* Checklists area */}
                        {data.checklists?.map((checklist: any) => (
                            <Checklist key={checklist.id} data={checklist} boardId={boardId} />
                        ))}

                        {/* Link Attachments area */}
                        {linkAttachments.length > 0 && (
                            <div className="flex items-start gap-x-3 w-full">
                                <Paperclip className="h-6 w-6 text-neutral-700 mt-1" />
                                <div className="w-full">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-neutral-700 mt-1">Attachments</h3>
                                    </div>
                                    <div className="flex flex-col gap-y-3">
                                        {linkAttachments.map((link: any) => (
                                            <div key={link.id} className="flex flex-col gap-y-1 w-full">
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-x-3 p-2 bg-neutral-50/50 hover:bg-neutral-100 rounded-md border transition w-full">
                                                    <div className="h-16 w-24 bg-neutral-200 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                                                        {link.thumbnailUrl ? (
                                                            <img src={link.thumbnailUrl} alt="Thumbnail" className="object-cover w-full h-full" />
                                                        ) : (
                                                            <span className="text-xs font-semibold text-neutral-500">LINK</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 pr-2 pb-1">
                                                        <span className="font-semibold text-sm text-neutral-700 truncate">{link.title || link.url}</span>
                                                        <span className="text-xs text-neutral-500 truncate mt-1">Website URL</span>
                                                    </div>
                                                </a>
                                                {link.thumbnailUrl && (
                                                    <div className="flex items-center gap-x-2 px-1 mt-1">
                                                        {!link.isCover ? (
                                                            <button
                                                                onClick={() => executeUpdateAttachmentCover({ id: link.id, cardId: data.id, boardId })}
                                                                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-200 hover:bg-neutral-300 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1"
                                                            >
                                                                <Layout className="w-3 h-3" /> Make Cover
                                                            </button>
                                                        ) : (
                                                            <button className="text-xs font-medium text-white bg-blue-600 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1 cursor-default">
                                                                <CheckSquare className="w-3 h-3" /> Current Cover
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => executeDeleteAttachment({ id: link.id, boardId })}
                                                            className="text-xs font-medium text-red-600 hover:text-red-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1 ml-auto"
                                                        >
                                                            <X className="w-3 h-3" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                                {!link.thumbnailUrl && (
                                                    <div className="flex items-center gap-x-2 px-1 mt-1 justify-end">
                                                        <button
                                                            onClick={() => executeDeleteAttachment({ id: link.id, boardId })}
                                                            className="text-xs font-medium text-red-600 hover:text-red-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-sm transition flex items-center gap-x-1 ml-auto"
                                                        >
                                                            <X className="w-3 h-3" /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Activity area */}
                        <div className="flex items-start gap-x-3 w-full">
                            <Activity className="h-6 w-6 text-neutral-700 mt-1" />
                            <div className="w-full">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-neutral-700 mt-1">Activity</h3>
                                    <button className="bg-[#e9eaec] text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4]">Show details</button>
                                </div>
                                {/* Mock Comment input */}
                                <div className="flex gap-x-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold mt-1">U</div>
                                    <div className="bg-white border rounded-md px-3 py-2 text-sm w-full h-12 shadow-sm text-neutral-400">Write a comment...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4 pt-1">
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2">Add to card</h4>

                        {/* Appearance / Colors */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    console.log("Appearance button clicked, current state:", isColorPickerOpen);
                                    setIsColorPickerOpen(!isColorPickerOpen);
                                }}
                                className="bg-[#e9eaec] w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] flex items-center gap-x-2"
                            >
                                <Layout className="h-4 w-4" /> Appearance
                            </button>
                            {isColorPickerOpen && (
                                <div className="absolute left-0 top-full mt-1 z-[100] w-56 bg-white rounded-md shadow-xl border-2 border-neutral-200 p-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-xs text-neutral-600">Card Appearance</span>
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
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {CARD_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => onBgColorSelect(color)}
                                                    className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10"
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                            <button
                                                onClick={() => onBgColorSelect("")}
                                                className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10 bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-medium"
                                            >
                                                none
                                            </button>
                                        </div>
                                    )}

                                    {colorPickerTab === "text" && (
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {TEXT_COLORS.map((color) => (
                                                <button
                                                    key={color}
                                                    onClick={() => onTextColorSelect(color)}
                                                    className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/20"
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                            <button
                                                onClick={() => onTextColorSelect("")}
                                                className="h-6 w-6 rounded-sm hover:opacity-80 transition shadow-sm border border-black/10 bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-medium"
                                            >
                                                auto
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Labels Pickers */}
                        <div className="relative">
                            <button onClick={() => setIsLabelPickerOpen(!isLabelPickerOpen)} className="bg-[#e9eaec] w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] flex items-center gap-x-2">
                                <Layout className="h-4 w-4" /> Labels
                            </button>
                            {isLabelPickerOpen && (
                                <div className="absolute top-8 right-0 z-10 w-64 bg-white rounded-md shadow-lg border p-3 cursor-default">
                                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                                        <span className="font-semibold text-sm text-neutral-600">Labels</span>
                                        <button onClick={() => setIsLabelPickerOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-0.5 rounded-sm">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-y-3">
                                        <input
                                            value={newLabelTitle}
                                            onChange={(e) => setNewLabelTitle(e.target.value)}
                                            placeholder="Label title..."
                                            className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                        />
                                        <div>
                                            <div className="text-xs font-semibold mt-1 mb-2 text-neutral-600 w-full text-center">Select a color</div>
                                            <div className="grid grid-cols-5 gap-1.5 mb-1">
                                                {CARD_COLORS.map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={() => {
                                                            executeCreateLabel({ cardId: data.id, boardId, title: newLabelTitle || "Label", color });
                                                        }}
                                                        className="h-8 w-full rounded-sm hover:scale-105 transition shadow-sm border border-black/10"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Date Picker */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    console.log("Dates button clicked, current state:", isDatePickerOpen);
                                    setIsDatePickerOpen(!isDatePickerOpen);
                                }}
                                className="bg-[#e9eaec] w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] flex items-center gap-x-2"
                            >
                                <Clock className="h-4 w-4" /> Dates
                            </button>
                            {isDatePickerOpen && (
                                <div className="absolute left-0 top-full mt-1 z-[100] w-64 bg-white rounded-md shadow-xl border-2 border-neutral-200 p-3 cursor-default" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                                        <span className="font-semibold text-sm text-neutral-600">Due Date</span>
                                        <button type="button" onClick={() => setIsDatePickerOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-0.5 rounded-sm">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-y-3">
                                        <label className="text-xs font-medium text-neutral-500">Select a date</label>
                                        <input
                                            type="date"
                                            defaultValue={optimisticDueDate ? new Date(optimisticDueDate).toISOString().split('T')[0] : ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const newDate = val ? new Date(val).toISOString() : null;
                                                setOptimisticDueDate(newDate);
                                                executeUpdateCard({ id: data.id, title: data.title, boardId, dueDate: newDate });
                                            }}
                                            className="text-sm px-2 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-600 w-full bg-white"
                                        />
                                        {optimisticDueDate && (
                                            <div className="text-xs text-neutral-600 bg-blue-50 px-2 py-1.5 rounded-sm">
                                                Currently set: {new Date(optimisticDueDate).toLocaleDateString()}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOptimisticDueDate(null);
                                                executeUpdateCard({ id: data.id, title: data.title, boardId, dueDate: null });
                                                setIsDatePickerOpen(false);
                                            }}
                                            className="text-xs bg-neutral-200 hover:bg-neutral-300 text-neutral-700 w-full py-2 rounded-sm transition font-medium"
                                        >
                                            Remove Due Date
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onAddChecklist} className="bg-[#e9eaec] w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] flex items-center gap-x-2"><CheckSquare className="h-4 w-4" /> Checklist</button>

                        {/* URL Attachment */}
                        <div className="relative">
                            <button onClick={() => setIsAddingImage(!isAddingImage)} className="bg-[#e9eaec] w-full text-left text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] flex items-center gap-x-2">
                                <Paperclip className="h-4 w-4" /> Attach URL
                            </button>
                            {isAddingImage && (
                                <div className="absolute top-full left-0 z-10 w-64 bg-white rounded-md shadow-md border px-3 py-3 mt-1">
                                    <div className="flex items-center justify-between mb-2 pb-1 border-b">
                                        <span className="text-sm font-semibold text-neutral-600 text-center w-full">Attach from URL</span>
                                        <button onClick={() => setIsAddingImage(false)} className="absolute right-2 px-1 py-1 hover:bg-neutral-100 rounded-sm">
                                            <X className="h-4 w-4 text-neutral-600" />
                                        </button>
                                    </div>
                                    <form onSubmit={onImageSubmit} className="flex flex-col gap-y-2 mt-2">
                                        <input
                                            ref={imageInputRef}
                                            name="url"
                                            placeholder="Paste any link or image URL..."
                                            className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                            autoFocus
                                        />
                                        <button type="submit" disabled={isAttachmentLoading} className="bg-blue-600 text-white rounded-sm text-sm font-medium px-4 py-1.5 hover:bg-blue-700 w-full transition">Attach</button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
