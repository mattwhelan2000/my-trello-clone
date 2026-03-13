"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { ScriptUploadModal } from "@/components/modals/script-upload-modal/ScriptUploadModal";

export const ImportScriptButton = () => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    return (
        <div className="w-full">
            <button
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition duration-200 flex items-center justify-center gap-x-2 h-11"
            >
                <UploadCloud className="h-5 w-5" />
                <span className="text-sm">Import from Script</span>
            </button>
            <ScriptUploadModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
            />
        </div>
    );
};
