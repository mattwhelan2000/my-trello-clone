import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
    handleServerError(e) {
        console.error("Action Server Error:", e.message);
        return e.message || "An unexpected error occurred.";
    }
});

// These types are used by the legacy useAction hook
export type FieldErrors<T> = {
    [K in keyof T]?: string[];
};

export type ActionState<TInput, TOutput> = {
    fieldErrors?: FieldErrors<TInput>;
    error?: string | null;
    data?: TOutput;
};
