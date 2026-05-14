import { create } from "zustand";

interface BoardStore {
    query: string;
    setQuery: (query: string) => void;
    searchCards: boolean;
    setSearchCards: (val: boolean) => void;
    searchLists: boolean;
    setSearchLists: (val: boolean) => void;
    searchInvert: boolean;
    setSearchInvert: (val: boolean) => void;
    
    selectedLabels: Set<string>;
    setSelectedLabels: (labels: Set<string>) => void;
    toggleLabelFilter: (title: string) => void;
    
    isFilterEnabled: boolean;
    setIsFilterEnabled: (val: boolean) => void;
    
    uniqueLabels: { title: string; color: string }[];
    setUniqueLabels: (labels: { title: string; color: string }[]) => void;

    boardLists: { id: string; title: string }[];
    setBoardLists: (lists: { id: string; title: string }[]) => void;

    visibleCardCount: number;
    setVisibleCardCount: (count: number) => void;
    visibleListCount: number;
    setVisibleListCount: (count: number) => void;
    visibleListIds: string[];
    setVisibleListIds: (ids: string[]) => void;

    isDateOrder: boolean;
    setIsDateOrder: (val: boolean) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
    query: "",
    setQuery: (query) => set({ query }),
    searchCards: true,
    setSearchCards: (searchCards) => set({ searchCards }),
    searchLists: false,
    setSearchLists: (searchLists) => set({ searchLists }),
    searchInvert: false,
    setSearchInvert: (searchInvert) => set({ searchInvert }),
    
    selectedLabels: new Set(),
    setSelectedLabels: (selectedLabels) => set({ selectedLabels }),
    toggleLabelFilter: (title) => set((state) => {
        const next = new Set(state.selectedLabels);
        if (next.has(title)) next.delete(title);
        else next.add(title);
        return { selectedLabels: next };
    }),
    
    isFilterEnabled: true,
    setIsFilterEnabled: (isFilterEnabled) => set({ isFilterEnabled }),

    uniqueLabels: [],
    setUniqueLabels: (uniqueLabels) => set({ uniqueLabels }),

    boardLists: [],
    setBoardLists: (boardLists) => set({ boardLists }),

    visibleCardCount: 0,
    setVisibleCardCount: (visibleCardCount) => set({ visibleCardCount }),
    visibleListCount: 0,
    setVisibleListCount: (visibleListCount) => set({ visibleListCount }),
    visibleListIds: [],
    setVisibleListIds: (visibleListIds) => set({ visibleListIds }),

    isDateOrder: false,
    setIsDateOrder: (isDateOrder) => set({ isDateOrder }),
}));
