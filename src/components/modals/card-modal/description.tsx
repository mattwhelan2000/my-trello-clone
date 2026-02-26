"use client";

import { useState, useRef, ElementRef } from "react";
import { AlignLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEventListener, useOnClickOutside } from "usehooks-ts";
import { useAction } from "@/hooks/use-action";
import { updateCardDescription } from "@/actions/update-card-description";
import MDEditor from "@uiw/react-md-editor";

interface DescriptionProps {
    data: any;
    boardId: string;
}

export const Description = ({ data, boardId }: DescriptionProps) => {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [descContent, setDescContent] = useState(data.description || "");
    const formRef = useRef<ElementRef<"form">>(null);
    const textareaRef = useRef<ElementRef<"textarea">>(null);

    const { execute, fieldErrors } = useAction(updateCardDescription, {
        onSuccess: (data) => {
            disableEditing();
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const enableEditing = () => {
        setIsEditing(true);
        // Reset to canonical data when we start editing (in case they cancelled last time)
        setDescContent(data.description || "");
        setTimeout(() => {
            // @ts-ignore
            textareaRef.current?.focus();
        });
    };

    const disableEditing = () => {
        setIsEditing(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            disableEditing();
        }
    };

    useEventListener("keydown", onKeyDown);
    // Removed useOnClickOutside as it intercepts native editor clicks like link inserting and pasting

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Use our controlled state variable
        if (descContent === data.description) return disableEditing();

        execute({ id: data.id, boardId, description: descContent });
    };

    return (
        <div className="flex items-start gap-x-3 w-full">
            <AlignLeft className="h-6 w-6 text-neutral-700 mt-1" />
            <div className="w-full">
                <h3 className="font-semibold text-neutral-700 mb-2 mt-1">Description</h3>

                {isEditing ? (
                    <form action="" ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-y-2">
                        <div data-color-mode="light">
                            <MDEditor
                                value={descContent}
                                onChange={(val) => setDescContent(val || "")}
                                preview="edit"
                                height={200}
                                textareaProps={{
                                    name: "description",
                                    // @ts-ignore
                                    ref: textareaRef
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-x-2 mt-2">
                            <button type="submit" className="bg-blue-600 text-white rounded-md text-sm font-medium px-4 py-2 hover:bg-blue-700 transition">Save</button>
                            <button type="button" onClick={disableEditing} className="px-3 py-2 text-sm hover:bg-neutral-100 rounded-md">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <div
                        onClick={enableEditing}
                        role="button"
                        className="bg-neutral-100 min-h-[78px] rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-200"
                    >
                        {data.description ? (
                            <div data-color-mode="light">
                                <MDEditor.Markdown source={data.description} className="text-sm bg-transparent !text-black" />
                            </div>
                        ) : (
                            "Add a more detailed description..."
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
