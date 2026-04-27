"use client";

import { List } from "@prisma/client";
import { ListItem } from "./ListItem";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    DragOverlay,
    closestCenter,
    useSensor,
    useSensors,
    PointerSensor,
    Active,
    Over
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useAction } from "@/hooks/use-action";
import { updateListOrder, updateCardOrder } from "@/actions/update-order";
import { createList } from "@/actions/create-list";
import { useRef, ElementRef } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [searchCards, setSearchCards] = useState(true);
    const [searchLists, setSearchLists] = useState(true);
    const searchInputRef = useRef<ElementRef<"input">>(null);

    const router = useRouter();
    const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
        onSuccess: () => {
            console.log("List order updated successfully on server.");
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const { execute: executeUpdateCardOrder } = useAction(updateCardOrder, {
        onSuccess: () => {
            console.log("Card order updated successfully on server.");
        },
        onError: (error) => {
            console.error(error);
        }
    });

    // Sync state when props change
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

    const { execute: executeCreateList, isLoading: isListLoading } = useAction(createList, {
        onSuccess: () => {
            disableEditing();
            router.refresh();
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;

        if (!title.trim()) return;

        executeCreateList({ title: title.trim(), boardId });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const [activeCard, setActiveCard] = useState<any>(null);

    const onDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === "Card") {
            setActiveCard(event.active.data.current.card);
        }
    };

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveCard = active.data.current?.type === "Card";
        const isOverCard = over.data.current?.type === "Card";
        const isOverList = over.data.current?.type === "List";

        if (!isActiveCard) return;

        // Optimistic local state only — no server calls during drag
        setOrderedData((prevItems) => {
            const activeList = prevItems.find((list) => list.cards.some((card: any) => card.id === activeId));
            const overList = prevItems.find((list) =>
                list.id === overId || list.cards.some((card: any) => card.id === overId)
            );

            if (!activeList || !overList) {
                return prevItems;
            }

            const activeCardIndex = activeList.cards.findIndex((card: any) => card.id === activeId);
            const overCardIndex = isOverCard
                ? overList.cards.findIndex((card: any) => card.id === overId)
                : overList.cards.length + 1;

            if (activeList.id === overList.id) {
                // Moving card within the same list
                const newCards = arrayMove(activeList.cards, activeCardIndex, overCardIndex);
                newCards.forEach((c: any, i) => c.order = i);

                return prevItems.map((list) => {
                    if (list.id === activeList.id) {
                        return { ...list, cards: newCards };
                    }
                    return list;
                });
            } else {
                // Moving card to a different list
                const activeCard = { ...activeList.cards[activeCardIndex], listId: overList.id };

                const newActiveCards = [...activeList.cards];
                newActiveCards.splice(activeCardIndex, 1);
                newActiveCards.forEach((c: any, i) => c.order = i);

                const newOverCards = [...overList.cards];
                newOverCards.splice(overCardIndex, 0, activeCard);
                newOverCards.forEach((c: any, i) => c.order = i);

                return prevItems.map((list) => {
                    if (list.id === activeList.id) return { ...list, cards: newActiveCards };
                    if (list.id === overList.id) return { ...list, cards: newOverCards };
                    return list;
                });
            }
        });
    };

    const onDragEnd = (event: DragEndEvent) => {
        setActiveCard(null);

        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const isActiveList = active.data.current?.type === "List";
        const isActiveCard = active.data.current?.type === "Card";

        if (isActiveList && activeId !== overId) {
            setOrderedData((prevItems) => {
                const activeIndex = prevItems.findIndex((list) => list.id === activeId);
                const overIndex = prevItems.findIndex((list) => list.id === overId);

                const newLists = arrayMove(prevItems, activeIndex, overIndex);
                newLists.forEach((list, index) => list.order = index);

                executeUpdateListOrder({ 
                    boardId, 
                    items: newLists.map((list) => ({ id: list.id, title: list.title, order: list.order, boardId })) 
                });

                return newLists;
            });
        }

        // Persist card order to server after drop (single call)
        if (isActiveCard) {
            setOrderedData((currentData) => {
                // Collect all cards that need updating (cards in affected lists)
                const allCards = currentData.flatMap((list) => list.cards);
                if (allCards.length > 0) {
                    executeUpdateCardOrder({ 
                         boardId, 
                         items: allCards.map((card) => ({ id: card.id, title: card.title, order: card.order, listId: card.listId })) 
                    });
                }
                return currentData; // no state change, just reading
            });
        }
    };

    const handleMoveList = useCallback((listId: string, direction: 'left' | 'right') => {
        setOrderedData((prevItems) => {
            const listIndex = prevItems.findIndex(l => l.id === listId);
            if (listIndex === -1) return prevItems;
            
            if (direction === 'left' && listIndex > 0) {
                const newLists = arrayMove(prevItems, listIndex, listIndex - 1);
                newLists.forEach((list, index) => list.order = index);
                executeUpdateListOrder({ boardId, items: newLists.map((list) => ({ id: list.id, title: list.title, order: list.order, boardId })) });
                return newLists;
            } else if (direction === 'right' && listIndex < prevItems.length - 1) {
                const newLists = arrayMove(prevItems, listIndex, listIndex + 1);
                newLists.forEach((list, index) => list.order = index);
                executeUpdateListOrder({ boardId, items: newLists.map((list) => ({ id: list.id, title: list.title, order: list.order, boardId })) });
                return newLists;
            }
            return prevItems;
        });
    }, [boardId]);

    const handleMoveCard = useCallback((cardId: string, listId: string, action: 'up' | 'down' | 'position', newPosition?: number) => {
        setOrderedData((prevItems) => {
            const list = prevItems.find(l => l.id === listId);
            if (!list) return prevItems;

            const cardIndex = list.cards.findIndex(c => c.id === cardId);
            if (cardIndex === -1) return prevItems;

            let newIndex = cardIndex;
            if (action === 'up' && cardIndex > 0) newIndex = cardIndex - 1;
            else if (action === 'down' && cardIndex < list.cards.length - 1) newIndex = cardIndex + 1;
            else if (action === 'position' && typeof newPosition === 'number') {
                newIndex = Math.max(0, Math.min(newPosition - 1, list.cards.length - 1));
            }

            if (newIndex === cardIndex) return prevItems;

            const newCards = arrayMove(list.cards, cardIndex, newIndex);
            newCards.forEach((c: any, i) => c.order = i);

            const newData = prevItems.map((l) => {
                if (l.id === listId) return { ...l, cards: newCards };
                return l;
            });

            // Persist
            const allCards = newData.flatMap(l => l.cards);
            executeUpdateCardOrder({ 
                boardId, 
                items: allCards.map((card) => ({ id: card.id, title: card.title, order: card.order, listId: card.listId })) 
            });

            return newData;
        });
    }, [boardId, executeUpdateCardOrder]);

    return (
        <div id="board-content">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
            >
                <SortableContext
                    items={orderedData.map((list) => list.id)}
                    strategy={horizontalListSortingStrategy}
                >
                    {/* Search Bar */}
                    <div className="fixed top-[52px] left-1/2 -translate-x-1/2 z-[30] flex flex-col items-center">
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder='Search cards... ("/")'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="text-sm pl-8 pr-[76px] py-1.5 rounded-md bg-black/30 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/50 outline-none focus:bg-black/50 focus:border-white/40 w-64 transition shadow-lg"
                            />
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-x-1">
                                {searchQuery.length > 0 && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        title="Clear search"
                                        className="text-[10px] font-bold h-5 w-5 rounded flex items-center justify-center transition border bg-red-500/80 border-red-600/50 text-white hover:bg-red-600/90"
                                    >
                                        X
                                    </button>
                                )}
                                <button
                                    onClick={() => setSearchCards(!searchCards)}
                                    title="Toggle Card search"
                                    className={`text-[10px] font-bold h-5 w-5 rounded flex items-center justify-center transition border ${searchCards ? 'bg-white/20 border-white/40 text-white' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'}`}
                                >
                                    C
                                </button>
                                <button
                                    onClick={() => setSearchLists(!searchLists)}
                                    title="Toggle List search"
                                    className={`text-[10px] font-bold h-5 w-5 rounded flex items-center justify-center transition border ${searchLists ? 'bg-white/20 border-white/40 text-white' : 'bg-transparent border-white/10 text-white/30 hover:border-white/20'}`}
                                >
                                    L
                                </button>
                            </div>
                        </div>

                        {searchQuery.trim().length > 0 && (
                            <div className="mt-1.5 bg-red-800/90 text-white/90 px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-x-6 shadow-md backdrop-blur-sm border border-red-700/50">
                                <span className="flex items-center gap-x-1.5">
                                    <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                    {orderedData.reduce((acc, list) => {
                                        const isListMatch = searchLists && list.title.toLowerCase().includes(searchQuery.toLowerCase());
                                        const hasMatchingCards = isListMatch || (searchCards && list.cards.some((c: any) => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))));
                                        return acc + (hasMatchingCards ? 1 : 0);
                                    }, 0)}
                                </span>
                                <div className="w-[1px] h-3 bg-red-700/50"></div>
                                <span className="flex items-center gap-x-1.5">
                                    <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                                    {orderedData.reduce((acc, list) => {
                                        const isListMatch = searchLists && list.title.toLowerCase().includes(searchQuery.toLowerCase());
                                        let listCardsMatched = 0;
                                        if (isListMatch) {
                                            listCardsMatched = list.cards.length;
                                        } else if (searchCards) {
                                            listCardsMatched = list.cards.filter((c: any) => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))).length;
                                        }
                                        return acc + listCardsMatched;
                                    }, 0)}
                                </span>
                            </div>
                        )}
                    </div>
                    <ol className="flex gap-x-3 h-full">
                        {orderedData.map((list, index) => {
                            return (
                                <ListItem
                                    key={list.id}
                                    index={index}
                                    data={list}
                                    searchQuery={searchQuery}
                                    searchCards={searchCards}
                                    searchLists={searchLists}
                                    listColorSwatches={listColorSwatches}
                                    textColorSwatches={textColorSwatches}
                                    onMoveList={handleMoveList}
                                    onMoveCard={handleMoveCard}
                                    isFirst={index === 0}
                                    isLast={index === orderedData.length - 1}
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
                </SortableContext>
                <DragOverlay>
                    {activeCard ? (
                        <div
                            className="rotate-3 shadow-xl rounded-md px-3 py-2 text-sm w-[250px] opacity-90 border border-neutral-300"
                            style={{
                                backgroundColor: activeCard.color || "#ffffff",
                                color: activeCard.fontColor || "#172b4d",
                            }}
                        >
                            {activeCard.title}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};
