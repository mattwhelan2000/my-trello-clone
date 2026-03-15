import { create } from 'zustand';

export interface ComfyTask {
    taskId: string;
    boardId: string;
    cardId: string;
    statusText: string;
}

interface ComfyStore {
    tasks: ComfyTask[];
    addTask: (task: ComfyTask) => void;
    updateTaskStatus: (taskId: string, statusText: string) => void;
    removeTask: (taskId: string) => void;
}

export const useComfyUIStore = create<ComfyStore>((set) => ({
    tasks: [],
    addTask: (task) => set((state) => ({ 
        tasks: state.tasks.find(t => t.taskId === task.taskId) ? state.tasks : [...state.tasks, task] 
    })),
    updateTaskStatus: (taskId, statusText) => set((state) => ({
        tasks: state.tasks.map(t => t.taskId === taskId ? { ...t, statusText } : t)
    })),
    removeTask: (taskId) => set((state) => ({
        tasks: state.tasks.filter(t => t.taskId !== taskId)
    }))
}));
