import { create } from "zustand";

interface BoardStore {
    query: string;
    setQuery: (query: string) => void;
    searchCards: boolean;
    setSearchCards: (val: boolean) => void;
    searchLists: boolean;
    setSearchLists: (val: boolean) => void;
    
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

    // Snapshot triggers
    snapshotSaveTrigger: number;
    triggerSnapshotSave: () => void;
    snapshotLoadTrigger: number;
    triggerSnapshotLoad: () => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
    query: "",
    setQuery: (query) => set({ query }),
    searchCards: true,
    setSearchCards: (searchCards) => set({ searchCards }),
    searchLists: false,
    setSearchLists: (searchLists) => set({ searchLists }),
    
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

    snapshotSaveTrigger: 0,
    triggerSnapshotSave: () => set((state) => ({ snapshotSaveTrigger: state.snapshotSaveTrigger + 1 })),
    snapshotLoadTrigger: 0,
    triggerSnapshotLoad: () => set((state) => ({ snapshotLoadTrigger: state.snapshotLoadTrigger + 1 })),
}));
