"use client";

import React, { useState } from "react";
import { Download, FileText, CheckSquare, Square, Loader2, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { useBoardStore } from "@/hooks/use-board-store";
import { useToast } from "@/components/ui/Toast";

interface DownloadBoardPDFProps {
    boardId: string;
    boardTitle: string;
}

export const DownloadBoardPDF = ({ boardId, boardTitle }: DownloadBoardPDFProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { boardLists } = useBoardStore();
    const { addToast } = useToast();
    
    const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());

    const toggleList = (id: string) => {
        const newSet = new Set(selectedListIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedListIds(newSet);
    };

    const selectAll = () => {
        setSelectedListIds(new Set(boardLists.map(l => l.id)));
    };

    const selectNone = () => {
        setSelectedListIds(new Set());
    };

    const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
            // Use our proxy-image API to avoid CORS
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) return null;
            
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Failed to fetch image:", error);
            return null;
        }
    };

    const downloadPdfBuffer = async (url: string): Promise<ArrayBuffer | null> => {
        try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) return null;
            return await response.arrayBuffer();
        } catch (error) {
            console.error("Failed to fetch PDF:", error);
            return null;
        }
    };

    const generatePDF = async () => {
        if (selectedListIds.size === 0) {
            addToast("Please select at least one list", "error");
            return;
        }

        setIsGenerating(true);
        try {
            const doc = new jsPDF();
            let yOffset = 20;
            const margin = 20;
            const pageWidth = doc.internal.pageSize.getWidth();
            const contentWidth = pageWidth - (margin * 2);

            // Title
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.text(boardTitle, margin, yOffset);
            yOffset += 15;

            const selectedLists = boardLists.filter(l => selectedListIds.has(l.id));
            const pdfAttachments: string[] = [];

            for (const list of selectedLists) {
                // Check for new page for each list
                if (yOffset > 20) {
                    doc.addPage();
                    yOffset = 20;
                }

                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(60, 60, 60);
                doc.text(list.title, margin, yOffset);
                yOffset += 10;

                for (const card of list.cards) {
                    // Check if we need a new page
                    if (yOffset > 260) {
                        doc.addPage();
                        yOffset = 20;
                    }

                    // Card Title
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);
                    doc.text(card.title, margin, yOffset);
                    yOffset += 7;

                    // Card Description
                    if (card.description) {
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(80, 80, 80);
                        const lines = doc.splitTextToSize(card.description, contentWidth);
                        doc.text(lines, margin, yOffset);
                        yOffset += (lines.length * 5) + 5;
                    }

                    // Attachments
                    for (const attachment of (card.attachments || [])) {
                        if (yOffset > 260) {
                            doc.addPage();
                            yOffset = 20;
                        }

                        const isImage = attachment.type === "IMAGE" || attachment.thumbnailUrl;
                        const isGMap = attachment.url.includes("google.com/maps") || attachment.url.includes("maps.app.goo.gl");
                        const isGDrive = attachment.url.includes("drive.google.com");
                        const isPDF = attachment.url.toLowerCase().endsWith(".pdf");

                        if (isImage && !isGMap && !isGDrive) {
                            const base64 = await fetchImageAsBase64(attachment.url);
                            if (base64) {
                                try {
                                    // Calculate dimensions (approximate)
                                    const imgWidth = 100;
                                    const imgHeight = 60;
                                    doc.addImage(base64, "JPEG", margin, yOffset, imgWidth, imgHeight);
                                    yOffset += imgHeight + 10;
                                } catch (e) {
                                    doc.setFontSize(8);
                                    doc.text(`[Image: ${attachment.title || 'Attached Image'}]`, margin, yOffset);
                                    yOffset += 5;
                                }
                            }
                        } else if (isPDF) {
                            doc.setFontSize(10);
                            doc.setTextColor(0, 0, 255);
                            doc.text(`[PDF Attachment: ${attachment.title || 'Document'}]`, margin, yOffset);
                            doc.link(margin, yOffset - 4, 100, 5, { url: attachment.url });
                            yOffset += 7;
                            pdfAttachments.push(attachment.url);
                        } else {
                            // Link
                            doc.setFontSize(10);
                            doc.setTextColor(0, 0, 255);
                            const linkTitle = isGMap ? "View on Google Maps" : (isGDrive ? "Open Google Drive" : (attachment.title || attachment.url));
                            doc.text(linkTitle, margin, yOffset);
                            doc.link(margin, yOffset - 4, 100, 5, { url: attachment.url });
                            yOffset += 7;
                        }
                    }

                    yOffset += 5; // Space between cards
                }
            }

            // Finalizing
            const mainPdfBytes = doc.output("arraybuffer");
            let finalPdfBytes = mainPdfBytes;

            // Merge linked PDFs if any
            if (pdfAttachments.length > 0) {
                const mergedPdf = await PDFDocument.create();
                const mainDoc = await PDFDocument.load(mainPdfBytes);
                const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
                mainPages.forEach(p => mergedPdf.addPage(p));

                for (const pdfUrl of pdfAttachments) {
                    const buffer = await downloadPdfBuffer(pdfUrl);
                    if (buffer) {
                        try {
                            const attachDoc = await PDFDocument.load(buffer);
                            const attachPages = await mergedPdf.copyPages(attachDoc, attachDoc.getPageIndices());
                            attachPages.forEach(p => mergedPdf.addPage(p));
                        } catch (e) {
                            console.error("Failed to merge PDF:", pdfUrl, e);
                        }
                    }
                }
                finalPdfBytes = await mergedPdf.save();
            }

            // Download
            const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${boardTitle.replace(/\s+/g, '-').toLowerCase()}-export.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            addToast("PDF Generated Successfully", "success");
            setIsOpen(false);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            addToast("Failed to generate PDF", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-black/20 hover:bg-black/30 text-white rounded-md px-3 py-1.5 flex items-center gap-x-2 text-sm font-medium backdrop-blur-sm transition"
            >
                <FileText className="h-4 w-4" />
                Download PDF
            </button>

            {isOpen && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-lg shadow-2xl border border-neutral-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 bg-neutral-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-x-2">
                            <Download className="h-4 w-4 text-neutral-600" />
                            <span className="font-bold text-sm text-neutral-700">Export Board to PDF</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between gap-x-2">
                            <button 
                                onClick={selectAll}
                                className="flex-1 flex items-center justify-center gap-x-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-semibold text-neutral-600 transition"
                            >
                                <CheckSquare className="h-3 w-3" />
                                All
                            </button>
                            <button 
                                onClick={selectNone}
                                className="flex-1 flex items-center justify-center gap-x-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-semibold text-neutral-600 transition"
                            >
                                <Square className="h-3 w-3" />
                                None
                            </button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {boardLists.map(list => (
                                <div 
                                    key={list.id}
                                    onClick={() => toggleList(list.id)}
                                    className={`flex items-center gap-x-3 px-3 py-2 rounded-md cursor-pointer transition ${selectedListIds.has(list.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-neutral-50 text-neutral-600'}`}
                                >
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selectedListIds.has(list.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-neutral-300'}`}>
                                        {selectedListIds.has(list.id) && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                                    </div>
                                    <span className="text-xs font-medium truncate flex-1 text-left">{list.title}</span>
                                    <span className="text-[10px] opacity-60">({list.cards?.length || 0})</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={generatePDF}
                            disabled={isGenerating || selectedListIds.size === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white rounded-md py-2.5 text-sm font-bold shadow-md shadow-blue-100 transition flex items-center justify-center gap-x-2"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating PDF...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Download {selectedListIds.size} Lists
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
