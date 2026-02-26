import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient();

// These types are used by the useAction hook
export type FieldErrors<T> = {
    [K in keyof T]?: string[];
};

export type ActionState<TInput, TOutput> = {
    fieldErrors?: FieldErrors<TInput>;
    error?: string | null;
    data?: TOutput;
};
