"use client";

import { detectFileType, getFileTypeLabel, FileCategory } from "@/lib/file-type-utils";
import { FileText, Film, Music, FileSpreadsheet, FileType, Code, File, Globe } from "lucide-react";

interface AttachmentPreviewProps {
    url: string;
    thumbnailUrl?: string | null;
    title?: string | null;
    className?: string;
}

/**
 * Renders a file-type-aware thumbnail preview for an attachment.
 * Supports: images, SVGs, PDFs, videos, audio, Office docs, code/text files, and generic links.
 */
export const AttachmentPreview = ({ url, thumbnailUrl, title, className = "" }: AttachmentPreviewProps) => {
    const fileType = detectFileType(url);

    return (
        <div className={`h-16 w-24 bg-neutral-200 rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center relative ${className}`}>
            {renderPreview(fileType, url, thumbnailUrl, title)}
        </div>
    );
};

function renderPreview(fileType: FileCategory, url: string, thumbnailUrl?: string | null, title?: string | null) {
    switch (fileType) {
        case 'image':
            return thumbnailUrl || url ? (
                <img src={thumbnailUrl || url} alt={title || "Image"} className="object-cover w-full h-full" />
            ) : (
                <span className="text-xs font-semibold text-neutral-500">IMG</span>
            );

        case 'svg':
            return (
                <img src={url} alt={title || "SVG"} className="object-contain w-full h-full p-1" />
            );

        case 'pdf':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-red-50">
                    <FileText className="h-6 w-6 text-red-600" />
                    <span className="text-[9px] font-bold text-red-600 mt-0.5">PDF</span>
                </div>
            );

        case 'video':
            return (
                <div className="relative w-full h-full bg-neutral-900">
                    <video
                        src={url}
                        className="object-cover w-full h-full"
                        muted
                        preload="metadata"
                        onLoadedData={(e) => {
                            // Seek to 1 second to get a preview frame
                            const video = e.target as HTMLVideoElement;
                            video.currentTime = 1;
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 rounded-full p-1">
                            <Film className="h-4 w-4 text-white" />
                        </div>
                    </div>
                </div>
            );

        case 'audio':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-purple-50">
                    <Music className="h-6 w-6 text-purple-600" />
                    <span className="text-[9px] font-bold text-purple-600 mt-0.5">AUDIO</span>
                </div>
            );

        case 'office-word':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-blue-50">
                    <FileText className="h-6 w-6 text-blue-700" />
                    <span className="text-[9px] font-bold text-blue-700 mt-0.5">WORD</span>
                </div>
            );

        case 'office-excel':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-green-50">
                    <FileSpreadsheet className="h-6 w-6 text-green-700" />
                    <span className="text-[9px] font-bold text-green-700 mt-0.5">EXCEL</span>
                </div>
            );

        case 'office-powerpoint':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-orange-50">
                    <FileType className="h-6 w-6 text-orange-600" />
                    <span className="text-[9px] font-bold text-orange-600 mt-0.5">PPT</span>
                </div>
            );

        case 'code':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-800">
                    <Code className="h-6 w-6 text-emerald-400" />
                    <span className="text-[9px] font-bold text-emerald-400 mt-0.5">CODE</span>
                </div>
            );

        case 'text':
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-100">
                    <File className="h-6 w-6 text-neutral-600" />
                    <span className="text-[9px] font-bold text-neutral-600 mt-0.5">TXT</span>
                </div>
            );

        case 'link':
        default:
            if (thumbnailUrl) {
                return <img src={thumbnailUrl} alt={title || "Thumbnail"} className="object-cover w-full h-full" />;
            }
            return (
                <div className="flex flex-col items-center justify-center w-full h-full bg-neutral-100">
                    <Globe className="h-6 w-6 text-neutral-500" />
                    <span className="text-[9px] font-bold text-neutral-500 mt-0.5">LINK</span>
                </div>
            );
    }
}

/**
 * Larger preview for display inside a card modal - shows more detail.
 */
export const AttachmentPreviewLarge = ({ url, title }: { url: string; title?: string | null }) => {
    const fileType = detectFileType(url);

    switch (fileType) {
        case 'pdf':
            return (
                <div className="w-full rounded-md overflow-hidden border bg-white">
                    <iframe
                        src={url}
                        className="w-full h-[400px]"
                        title={title || "PDF Preview"}
                    />
                </div>
            );

        case 'video':
            return (
                <div className="w-full rounded-md overflow-hidden bg-black">
                    <video
                        src={url}
                        controls
                        className="w-full max-h-[400px]"
                        preload="metadata"
                    />
                </div>
            );

        case 'audio':
            return (
                <div className="w-full rounded-md overflow-hidden bg-purple-50 p-4 flex flex-col items-center gap-y-2 border">
                    <Music className="h-8 w-8 text-purple-600" />
                    <audio
                        src={url}
                        controls
                        className="w-full"
                        preload="metadata"
                    />
                </div>
            );

        case 'office-word':
        case 'office-excel':
        case 'office-powerpoint':
            return (
                <div className="w-full rounded-md overflow-hidden border bg-white">
                    <iframe
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
                        className="w-full h-[400px]"
                        title={title || "Document Preview"}
                    />
                </div>
            );

        default:
            return null;
    }
};
