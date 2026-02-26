"use client";

import { List } from "@prisma/client";
import { ListItem } from "./ListItem";
import { useState, useEffect } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
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
}: {
    data: ListWithCards[];
    boardId: string;
}) => {
    const [orderedData, setOrderedData] = useState(data);

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
    };

    useEventListener("keydown", onKeyDown);
    useOnClickOutside(formRef as React.RefObject<HTMLElement>, disableEditing);

    const { execute: executeCreateList, isLoading: isListLoading } = useAction(createList, {
        onSuccess: () => {
            disableEditing();
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

    const onDragStart = (event: DragStartEvent) => {
        // Optional: Could set active element for dragging overlays
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

        // Moving a card
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
                newCards.forEach((c: any, i) => c.order = i); // update order

                const newListsArr = prevItems.map((list) => {
                    if (list.id === activeList.id) {
                        return { ...list, cards: newCards };
                    }
                    return list;
                });

                // Server state
                executeUpdateCardOrder({ boardId, items: newCards });

                return newListsArr;
            } else {
                // Moving card to a different list
                const activeCard = activeList.cards[activeCardIndex];
                activeCard.listId = overList.id; // update local pointer

                const newActiveCards = [...activeList.cards];
                newActiveCards.splice(activeCardIndex, 1);
                newActiveCards.forEach((c: any, i) => c.order = i);

                const newOverCards = [...overList.cards];
                newOverCards.splice(overCardIndex, 0, activeCard);
                newOverCards.forEach((c: any, i) => c.order = i);

                const newListsArr = prevItems.map((list) => {
                    if (list.id === activeList.id) return { ...list, cards: newActiveCards };
                    if (list.id === overList.id) return { ...list, cards: newOverCards };
                    return list;
                });

                // Server state
                executeUpdateCardOrder({ boardId, items: newOverCards });

                return newListsArr;
            }
        });
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveList = active.data.current?.type === "List";

        if (isActiveList) {
            setOrderedData((prevItems) => {
                const activeIndex = prevItems.findIndex((list) => list.id === activeId);
                const overIndex = prevItems.findIndex((list) => list.id === overId);

                const newLists = arrayMove(prevItems, activeIndex, overIndex);
                newLists.forEach((list, index) => list.order = index);

                // Server state
                executeUpdateListOrder({ boardId, items: newLists });

                return newLists;
            });
        }
    };

    return (
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
                <ol className="flex gap-x-3 h-full">
                    {orderedData.map((list, index) => {
                        return <ListItem key={list.id} index={index} data={list} />;
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
                                    className="text-sm px-2 py-1 font-medium border-transparent hover:border-input focus:border-input transition w-full outline-none"
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
        </DndContext>
    );
};
