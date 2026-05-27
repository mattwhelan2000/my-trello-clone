"use client";

import { List } from "@prisma/client";
import { ListItem } from "./ListItem";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateListOrder, updateCardOrder } from "@/actions/update-order";
import { createList } from "@/actions/create-list";
import { useRef, ElementRef } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { deleteCards } from "@/actions/delete-cards";
import { moveCardsBatch } from "@/actions/move-cards-batch";
import { useToast } from "@/components/ui/Toast";
import { 
    Filter, 
    Tag, 
    Trash, 
    Trash2, 
    ChevronDown, 
    AlertTriangle, 
    CheckCircle2, 
    Move, 
    X, 
    Search,
    Layout,
    AlignLeft,
    CheckSquare,
    Clock,
    Paperclip,
    MessageSquare,
    Plus,
    Maximize2,
    MinusSquare
} from "lucide-react";
import { addLabelsBatch } from "@/actions/add-labels-batch";
import { deleteLabelBatch } from "@/actions/delete-label-batch";
import { useBoardStore } from "@/hooks/use-board-store";
import { BatchCardPropertiesModal } from "@/components/modals/batch-card-properties-modal";
import { bulkUpdateCards } from "@/actions/bulk-update-cards";

type ListWithCards = List & { cards: any[] };

export const ListContainer = ({
    data,
    boardId,
    listColorSwatches,
    textColorSwatches,
}: {
    data: ListWithCards[];
    boardId: string;
    listColorSwatches?: string[];
    textColorSwatches?: string[];
}) => {
    const [orderedData, setOrderedData] = useState(data);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        setOrderedData(data);
    }, [data]);
    
    // Use Global Board Store
    const { 
        query, 
        setQuery,
        searchCards, 
        setSearchCards,
        searchLists, 
        setSearchLists,
        searchInvert,
        selectedLabels, 
        isFilterEnabled, 
        setIsFilterEnabled,
        uniqueLabels,
        setUniqueLabels,
        boardLists,
        setBoardLists,
        visibleCardCount,
        setVisibleCardCount,
        visibleListCount,
        setVisibleListCount,
        visibleListIds,
        setVisibleListIds,
        isDateOrder,
        showFullList,
    } = useBoardStore();

    const { addToast } = useToast();
    const router = useRouter();
    const searchQuery = query;
    const setSearchQuery = setQuery;

    const { execute: executeBulkUpdate } = useSafeAction(bulkUpdateCards, {
        onSuccess: ({ data }) => {
            if (data?.count) addToast(`Successfully updated ${data.count} cards`, "success");
        },
        onError: (error) => {
            addToast("Failed to bulk update cards", "error");
        }
    });

    const sortedData = useMemo(() => {
        if (!isDateOrder) return orderedData;

        return [...orderedData].sort((a, b) => {
            // Find "DAY" card for each list to get the shoot date
            const dayCardA = a.cards.find(c => c.title.toUpperCase().startsWith("DAY "));
            const dayCardB = b.cards.find(c => c.title.toUpperCase().startsWith("DAY "));

            // If no day card, push to the end
            const dateA = dayCardA?.dueDate ? new Date(dayCardA.dueDate).getTime() : Infinity;
            const dateB = dayCardB?.dueDate ? new Date(dayCardB.dueDate).getTime() : Infinity;

            if (dateA !== dateB) return dateA - dateB;

            // Secondary sort: Scene number (from list title, e.g. "Sc001" -> 1)
            const sceneA = parseInt(a.title.replace(/\D/g, ""), 10) || 0;
            const sceneB = parseInt(b.title.replace(/\D/g, ""), 10) || 0;
            
            if (sceneA !== sceneB) return sceneA - sceneB;
            
            return a.order - b.order;
        });
    }, [orderedData, isDateOrder]);

    const { execute: executeUpdateListOrder, isExecuting: isLoadingList } = useSafeAction(updateListOrder, {
        onSuccess: () => {
            addToast("List reordered", "success");
            router.refresh();
        },
        onError: (error) => {
            addToast("Failed to reorder lists", "error");
        }
    });

    const { execute: executeUpdateCardOrder, isExecuting: isLoadingCard } = useSafeAction(updateCardOrder, {
        onSuccess: () => {
            addToast("Card reordered", "success");
            router.refresh();
        },
        onError: (error) => {
            addToast("Failed to reorder cards", "error");
        }
    });

    const { execute: executeAddLabels, isExecuting: isLabeling } = useSafeAction(addLabelsBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast("Labels added successfully", "success");
                setSelectedCardIds(new Set());
                setIsMultiSelectMode(false);
            }
        }
    });

    const { execute: executeDeleteCards, isExecuting: isDeletingBatch } = useSafeAction(deleteCards, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast(`Successfully deleted ${data.count} cards`, "success");
                setSelectedCardIds(new Set());
                setIsMultiSelectMode(false);
            }
        }
    });

    const { execute: executeMoveCards, isExecuting: isMovingBatch } = useSafeAction(moveCardsBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast(`Successfully moved ${data.count} cards`, "success");
                setSelectedCardIds(new Set());
                setIsMultiSelectMode(false);
            }
        }
    });




    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const searchInputRef = useRef<ElementRef<"input">>(null);

    // Batch Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

    // Batch Move State
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveCardIds, setMoveCardIds] = useState<Set<string>>(new Set());
    const [targetPosition, setTargetPosition] = useState(1);

    // Batch Label State
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [labelCardIds, setLabelCardIds] = useState<Set<string>>(new Set());
    const [newLabelTitle, setNewLabelTitle] = useState("");
    const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

    // Label Delete State
    const [labelToDelete, setLabelToDelete] = useState<string | null>(null);

    // Batch Card Properties State
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);


    // --- Optimized Filtering & Ordering Logic ---

    // 1. Compute which cards are visible based on search and label filters
    const visibleCards = useMemo(() => {
        const query = (searchQuery || "").toLowerCase().trim();
        const terms = query.split(',').map(t => t.trim()).filter(t => t !== "");
        const results: any[] = [];
        const isFilterActive = terms.length > 0 || selectedLabels.size > 0;
        
        orderedData.forEach(list => {
            const isListMatch = searchLists && terms.length > 0 && terms.every(term => list.title.toLowerCase().includes(term));
            
            let listHasMatch = false;
            if (showFullList && isFilterActive) {
                listHasMatch = list.cards.some(card => {
                    let matchesLabels = selectedLabels.size === 0 || card.labels.some((l: any) => selectedLabels.has(l.title));
                    let matchesSearch = true;
                    
                    if (terms.length > 0) {
                        const isCardMatch = searchCards && terms.every(term => 
                            card.title.toLowerCase().includes(term) ||
                            (card.description && card.description.toLowerCase().includes(term))
                        );
                        matchesSearch = isListMatch || isCardMatch;
                    }

                    let isVisible = matchesLabels && matchesSearch;
                    
                    if (searchInvert && (terms.length > 0 || selectedLabels.size > 0)) {
                        isVisible = !isVisible;
                    }
                    return isVisible;
                });
            }

            list.cards.forEach(card => {
                let isVisible = true;
                
                if (isFilterActive) {
                    if (showFullList && listHasMatch) {
                        isVisible = true;
                    } else {
                        let matchesLabels = selectedLabels.size === 0 || card.labels.some((l: any) => selectedLabels.has(l.title));
                        let matchesSearch = true;
                        
                        if (terms.length > 0) {
                            const isCardMatch = searchCards && terms.every(term => 
                                card.title.toLowerCase().includes(term) ||
                                (card.description && card.description.toLowerCase().includes(term))
                            );
                            matchesSearch = isListMatch || isCardMatch;
                        }

                        isVisible = matchesLabels && matchesSearch;
                        
                        if (searchInvert && (terms.length > 0 || selectedLabels.size > 0)) {
                            isVisible = !isVisible;
                        }
                    }
                }

                if (isVisible) {
                    results.push({ ...card, listTitle: list.title });
                }
            });
        });
        
        return results;
    }, [orderedData, searchQuery, searchCards, searchLists, selectedLabels, searchInvert, showFullList]);


    // 2. Compute which lists should be visible (if they match search or have visible cards)
    const visibleLists = useMemo(() => {
        const query = (searchQuery || "").toLowerCase().trim();
        const terms = query.split(',').map(t => t.trim()).filter(t => t !== "");
        const isFilterActive = terms.length > 0 || (selectedLabels.size > 0 && isFilterEnabled);
        
        if (!isFilterActive) return orderedData;

        return orderedData.filter(list => {
            const isListMatch = searchLists && terms.length > 0 && terms.every(term => list.title.toLowerCase().includes(term));
            
            // Re-evaluate list visibility considering inverted logic for cards
            const hasVisibleCard = list.cards.some(card => {
                let matchesLabels = selectedLabels.size === 0 || card.labels.some((l: any) => selectedLabels.has(l.title));
                let matchesSearch = true;
                if (terms.length > 0) {
                    const isCardMatch = searchCards && terms.every(term => 
                        card.title.toLowerCase().includes(term) ||
                        (card.description && card.description.toLowerCase().includes(term))
                    );
                    matchesSearch = isListMatch || isCardMatch;
                }
                
                let isVisible = matchesLabels && matchesSearch;
                if (searchInvert && (terms.length > 0 || selectedLabels.size > 0)) {
                    isVisible = !isVisible;
                }
                return isVisible;
            });

            // If inverted, we want to show the list if it has a visible card.
            if (searchInvert) {
                 return hasVisibleCard;
            }

            return isListMatch || hasVisibleCard;
        });
    }, [orderedData, searchQuery, searchCards, searchLists, selectedLabels, isFilterEnabled, searchInvert]);


    // 3. Sync counts to store (with equality check to prevent loops)
    useEffect(() => {
        const vCardsCount = visibleCards.length;
        const vListsCount = visibleLists.length;
        const vListIds = visibleLists.map(l => l.id);
        
        if (vCardsCount !== visibleCardCount) setVisibleCardCount(vCardsCount);
        if (vListsCount !== visibleListCount) setVisibleListCount(vListsCount);
        
        // Use JSON.stringify for quick array comparison
        if (JSON.stringify(vListIds) !== JSON.stringify(visibleListIds)) {
            setVisibleListIds(vListIds);
        }
    }, [visibleCards.length, visibleLists, visibleCardCount, visibleListCount, visibleListIds, setVisibleCardCount, setVisibleListCount, setVisibleListIds]);


    // 4. Sync unique labels and lists to store
    useEffect(() => {
        // Collect labels
        const labelMap = new Map<string, string>();
        data.forEach(l => l.cards.forEach(c => c.labels?.forEach((lab: any) => {
            if (!labelMap.has(lab.title)) labelMap.set(lab.title, lab.color);
        })));
        
        const labels = Array.from(labelMap.entries()).map(([title, color]) => ({ title, color })).sort((a,b) => a.title.localeCompare(b.title));
        const labelsJson = JSON.stringify(labels);
        if (labelsJson !== JSON.stringify(uniqueLabels)) {
            setUniqueLabels(labels);
        }
        
        // Collect list metadata
        const lists = data.map(l => ({ id: l.id, title: l.title }));
        const listsJson = JSON.stringify(lists);
        if (listsJson !== JSON.stringify(boardLists)) {
            setBoardLists(lists);
        }
    }, [data, uniqueLabels, boardLists, setUniqueLabels, setBoardLists]);


    // 5. Sync state when props change
    useEffect(() => {
        setOrderedData(data);
    }, [data]);

    const [isEditing, setIsEditing] = useState(false);
    const formRef = useRef<ElementRef<"form">>(null);
    const inputRef = useRef<ElementRef<"input">>(null);

    const enableEditing = () => {
        setIsEditing(true);
        setTimeout(() => {
            inputRef.current?.focus();
        });
    };

    const disableEditing = () => {
        setIsEditing(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") disableEditing();
        // Keyboard shortcut: '/' focuses search
        if (e.key === "/" && !isEditing && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            searchInputRef.current?.focus();
        }
    };

    useEventListener("keydown", onKeyDown);
    useOnClickOutside(formRef as React.RefObject<HTMLElement>, disableEditing);

    const { execute: executeCreateList, isExecuting: isListLoading } = useSafeAction(createList, {
        onSuccess: () => {
            disableEditing();
            addToast("List created", "success");
            router.refresh();
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to create list", "error");
        },
    });

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;

        if (!title.trim()) return;

        executeCreateList({ title, boardId });
    };

    // Array Move Utility (since we removed dnd-kit)
    const arrayMove = (array: any[], from: number, to: number) => {
        const newArray = array.slice();
        newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
        return newArray;
    };

    const handleMoveList = useCallback((listId: string, direction: 'left' | 'right' | 'position', newPosition?: number) => {
        const listIndex = orderedData.findIndex(l => l.id === listId);
        if (listIndex === -1) return;

        let targetIndex = listIndex;
        if (direction === 'left' && listIndex > 0) {
            targetIndex = listIndex - 1;
        } else if (direction === 'right' && listIndex < orderedData.length - 1) {
            targetIndex = listIndex + 1;
        } else if (direction === 'position' && typeof newPosition === 'number') {
            targetIndex = Math.max(0, Math.min(newPosition - 1, orderedData.length - 1));
        }

        if (targetIndex === listIndex) return;

        const newLists = arrayMove(orderedData, listIndex, targetIndex).map((list, index) => ({
            ...list,
            order: index
        }));

        setOrderedData(newLists);
        
        console.log(`[ListContainer] Executing updateListOrder for board ${boardId} with ${newLists.length} items`);
        executeUpdateListOrder({ boardId, items: newLists.map((list) => ({ id: list.id, title: list.title, order: list.order, boardId })) });
    }, [boardId, executeUpdateListOrder, orderedData, router]);

    const handleMoveCard = useCallback((cardId: string, listId: string, action: 'up' | 'down' | 'position', newPosition?: number) => {
        const list = orderedData.find(l => l.id === listId);
        if (!list) return;

        const cardIndex = list.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        let newIndex = cardIndex;
        if (action === 'up' && cardIndex > 0) newIndex = cardIndex - 1;
        else if (action === 'down' && cardIndex < list.cards.length - 1) newIndex = cardIndex + 1;
        else if (action === 'position' && typeof newPosition === 'number') {
            newIndex = Math.max(0, Math.min(newPosition - 1, list.cards.length - 1));
        }

        if (newIndex === cardIndex) return;

        // Avoid in-place mutation of state objects
        const newCards = arrayMove(list.cards, cardIndex, newIndex).map((card, i) => ({
            ...card,
            order: i
        }));

        const newData = orderedData.map((l) => {
            if (l.id === listId) return { ...l, cards: newCards };
            return l;
        });

        setOrderedData(newData);

        // Persist ONLY the cards in the affected list
        const itemsToUpdate = newCards.map((card) => ({
            id: card.id,
            order: card.order,
            listId: card.listId
        }));

        executeUpdateCardOrder({
            boardId,
            items: itemsToUpdate
        });
    }, [boardId, executeUpdateCardOrder, orderedData]);







    const openDeleteModal = () => {
        setSelectedCardIds(new Set(visibleCards.map(c => c.id)));
        setIsDeleteModalOpen(true);
    };

    const toggleCardSelection = (id: string) => {
        const next = new Set(selectedCardIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCardIds(next);
    };



    const openMoveModal = () => {
        setMoveCardIds(new Set(visibleCards.map(c => c.id)));
        setIsMoveModalOpen(true);
    };

    const toggleMoveSelection = (id: string) => {
        const next = new Set(moveCardIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setMoveCardIds(next);
    };



    const openLabelModal = () => {
        setLabelCardIds(new Set(visibleCards.map(c => c.id)));
        setIsLabelModalOpen(true);
    };

    const toggleLabelSelection = (id: string) => {
        const next = new Set(labelCardIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setLabelCardIds(next);
    };

    // Toggling moved to store

    const { execute: executeDeleteLabel, isExecuting: isDeletingLabel } = useSafeAction(deleteLabelBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast(`Successfully deleted label from board`, "success");
                setLabelToDelete(null);
                router.refresh();
            }
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to delete label", "error");
        }
    });


    if (!isMounted) return null;

    return (
        <div id="board-content" className="relative pb-20">
            {/* Batch Card Properties Button - Fixed Bottom Center */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-x-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                    onClick={() => setIsBatchModalOpen(true)}
                    className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all active:scale-95 flex items-center gap-x-3 border border-white/20 ring-1 ring-white/10 group"
                >
                    <div className="p-1 bg-blue-500/20 rounded-md group-hover:bg-blue-500/30 transition">
                        <Layout className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="leading-none">Batch Card Properties</span>
                        <span className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Affects {visibleCards.length} Visible Cards</span>
                    </div>
                </button>
            </div>

            <ol className="flex gap-x-3 h-full">
                {sortedData.map((list, index) => {
                    return (
                        <ListItem
                            key={list.id}
                            index={index}
                            data={list}
                            searchQuery={searchQuery}
                            searchCards={searchCards}
                            searchLists={searchLists}
                            searchInvert={searchInvert}
                            selectedLabels={selectedLabels}
                            showFullList={showFullList}
                            listColorSwatches={listColorSwatches}
                            textColorSwatches={textColorSwatches}
                            onMoveList={handleMoveList}
                            onMoveCard={handleMoveCard}
                            isFirst={index === 0}
                            isLast={index === sortedData.length - 1}
                        />
                    );
                })}

                {/* Add New List Button/Form */}
                <div className="shrink-0 w-[272px]">
                    {isEditing ? (
                        <form
                            ref={formRef}
                            onSubmit={onSubmit}
                            className="w-full bg-white rounded-md shadow-md p-3 space-y-3"
                        >
                            <input
                                ref={inputRef}
                                name="title"
                                id="title"
                                className="text-sm px-2 py-1 font-medium border-transparent hover:border-input focus:border-input transition w-full outline-none text-black bg-white"
                                placeholder="Enter list title..."
                            />
                            <div className="flex items-center gap-x-1">
                                <button
                                    type="submit"
                                    disabled={isListLoading}
                                    className="bg-blue-600 text-white hover:bg-blue-700 transition px-3 py-1.5 rounded-md text-sm font-medium"
                                >
                                    Add list
                                </button>
                                <button
                                    type="button"
                                    onClick={disableEditing}
                                    className="px-2 py-1.5 text-sm hover:bg-black/5 rounded-md"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={enableEditing}
                            className="w-full bg-white/50 hover:bg-white/80 transition rounded-md p-3 text-sm font-medium flex items-center"
                        >
                            + Add a list
                        </button>
                    )}
                </div>
            </ol>

            {/* Batch Delete Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                            <div className="flex items-center gap-x-3">
                                <Trash2 className="h-6 w-6 text-red-600" />
                                <div>
                                    <h3 className="font-bold text-neutral-900">Batch Delete Cards</h3>
                                    <p className="text-xs text-neutral-600">Delete {selectedCardIds.size} cards permanently.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto px-6 py-4 space-y-2">
                            {visibleCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => toggleCardSelection(card.id)}
                                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition ${selectedCardIds.has(card.id) ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-200 opacity-60'}`}
                                >
                                    <div className="flex flex-col gap-y-0.5">
                                        <span className="text-sm font-semibold text-neutral-800">{card.title}</span>
                                        <span className="text-[10px] text-neutral-500 uppercase tracking-tight">List: {card.listTitle}</span>
                                    </div>
                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition ${selectedCardIds.has(card.id) ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-neutral-300'}`}>
                                        {selectedCardIds.has(card.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 bg-neutral-50 border-t flex items-center gap-x-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeDeleteCards({ ids: Array.from(selectedCardIds), boardId })}
                                disabled={isDeletingBatch || selectedCardIds.size === 0}
                                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition shadow-md shadow-red-200 flex items-center justify-center gap-x-2"
                            >
                                {isDeletingBatch ? "Deleting..." : <><Trash2 className="h-4 w-4" /> Delete Selected</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Move Modal */}
            {isMoveModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                            <div className="flex items-center gap-x-3">
                                <Move className="h-6 w-6 text-blue-600" />
                                <div>
                                    <h3 className="font-bold text-neutral-900">Batch Move Cards</h3>
                                    <p className="text-xs text-neutral-600">Move {moveCardIds.size} cards to a specific position.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsMoveModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
                            <label className="text-sm font-semibold text-neutral-700">Target Position:</label>
                            <div className="flex items-center gap-x-2">
                                <span className="text-xs text-neutral-400 font-mono">#</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetPosition}
                                    onChange={(e) => setTargetPosition(parseInt(e.target.value) || 1)}
                                    className="w-16 px-2 py-1 border rounded text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="max-h-[250px] overflow-y-auto px-6 py-4 space-y-2">
                            {visibleCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => toggleMoveSelection(card.id)}
                                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition ${moveCardIds.has(card.id) ? 'bg-blue-50 border-blue-200' : 'bg-neutral-50 border-neutral-200 opacity-60'}`}
                                >
                                    <div className="flex flex-col gap-y-0.5">
                                        <div className="flex items-center gap-x-2">
                                            <span className="text-sm font-semibold text-neutral-800">{card.title}</span>
                                            <span className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded font-mono">Currently #{card.order + 1}</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-500 uppercase tracking-tight">List: {card.listTitle}</span>
                                    </div>
                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition ${moveCardIds.has(card.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-neutral-300'}`}>
                                        {moveCardIds.has(card.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 bg-neutral-50 border-t flex items-center gap-x-3">
                            <button
                                onClick={() => setIsMoveModalOpen(false)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeMoveCards({ ids: Array.from(moveCardIds), boardId, targetPosition })}
                                disabled={isMovingBatch || moveCardIds.size === 0}
                                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition shadow-md shadow-blue-200 flex items-center justify-center gap-x-2"
                            >
                                {isMovingBatch ? "Moving..." : <><Move className="h-4 w-4" /> Move to #{targetPosition}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Label Modal */}
            {isLabelModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-x-3">
                                <Tag className="h-6 w-6 text-indigo-600" />
                                <div>
                                    <h3 className="font-bold text-neutral-900">Batch Add Label</h3>
                                    <p className="text-xs text-neutral-600">Apply a label to {labelCardIds.size} cards.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsLabelModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-indigo-50/30 border-b border-indigo-100 space-y-4">
                            {uniqueLabels.length > 0 && (
                                <div className="flex flex-col gap-y-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase">Use Existing Label:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueLabels.map(label => (
                                            <button
                                                key={`select-${label.title}`}
                                                onClick={() => {
                                                    setNewLabelTitle(label.title);
                                                    setNewLabelColor(label.color);
                                                }}
                                                className={`text-[10px] font-bold px-2 py-1 rounded border transition flex items-center gap-x-1.5 ${newLabelTitle === label.title ? 'ring-2 ring-indigo-500 border-indigo-500 bg-white' : 'bg-white/50 border-neutral-200 hover:border-neutral-300'}`}
                                            >
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                                                {label.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-y-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase">{uniqueLabels.length > 0 ? "Or Type New Label:" : "Label Title:"}</label>
                                <input
                                    type="text"
                                    placeholder="e.g. APPROVED, VFX, PENDING"
                                    value={newLabelTitle}
                                    onChange={(e) => setNewLabelTitle(e.target.value.toUpperCase())}
                                    className="w-full px-3 py-2 border rounded text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                />
                            </div>
                            <div className="flex flex-col gap-y-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase">Label Color:</label>
                                <div className="flex items-center gap-x-2">
                                    <input
                                        type="color"
                                        value={newLabelColor}
                                        onChange={(e) => setNewLabelColor(e.target.value)}
                                        className="h-8 w-8 rounded cursor-pointer border-none bg-transparent"
                                    />
                                    <span className="text-[10px] font-mono text-neutral-500 uppercase">{newLabelColor}</span>
                                    <div className="flex-1 flex gap-x-1 justify-end">
                                        {["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef"].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewLabelColor(color)}
                                                className={`h-5 w-5 rounded-full border transition ${newLabelColor === color ? 'border-neutral-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="max-h-[200px] overflow-y-auto px-6 py-4 space-y-2">
                            {visibleCards.map((card) => (
                                <div
                                    key={card.id}
                                    onClick={() => toggleLabelSelection(card.id)}
                                    className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition ${labelCardIds.has(card.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-neutral-50 border-neutral-200 opacity-60'}`}
                                >
                                    <div className="flex flex-col gap-y-0.5">
                                        <span className="text-sm font-semibold text-neutral-800">{card.title}</span>
                                        <span className="text-[10px] text-neutral-500 uppercase tracking-tight">List: {card.listTitle}</span>
                                    </div>
                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition ${labelCardIds.has(card.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-300'}`}>
                                        {labelCardIds.has(card.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 bg-neutral-50 border-t flex items-center gap-x-3">
                            <button
                                onClick={() => setIsLabelModalOpen(false)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeAddLabels({ cardIds: Array.from(labelCardIds), boardId, labelTitle: newLabelTitle, labelColor: newLabelColor })}
                                disabled={isLabeling || labelCardIds.size === 0 || !newLabelTitle.trim()}
                                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition shadow-md shadow-indigo-200 flex items-center justify-center gap-x-2 disabled:opacity-50"
                            >
                                {isLabeling ? "Adding..." : <><Tag className="h-4 w-4" /> Add to {labelCardIds.size} Cards</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Label Confirmation Modal */}
            {labelToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-red-100">
                        <div className="bg-red-50 px-6 py-5 flex flex-col items-center text-center">
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="font-bold text-neutral-900 text-lg">Delete Label?</h3>
                            <p className="text-sm text-neutral-600 mt-1">
                                This will remove the label <span className="font-bold text-red-600">"{labelToDelete}"</span> from every card on this board.
                            </p>
                        </div>

                        <div className="px-6 py-4 bg-neutral-50 flex flex-col gap-y-2">
                            <button
                                onClick={() => executeDeleteLabel({ boardId, labelTitle: labelToDelete })}
                                disabled={isDeletingLabel}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-sm shadow-md transition disabled:opacity-50"
                            >
                                {isDeletingLabel ? "Deleting..." : "Yes, Delete from Board"}
                            </button>
                            <button
                                onClick={() => setLabelToDelete(null)}
                                className="w-full py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <BatchCardPropertiesModal 
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                cardIds={visibleCards.map(c => c.id)}
                boardId={boardId}
            />
        </div>
    );
};
