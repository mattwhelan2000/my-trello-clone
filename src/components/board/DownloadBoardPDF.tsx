"use client";

import React, { useState, useEffect } from "react";
import { Download, FileText, CheckSquare, Square, Loader2, X, AlertTriangle, Calendar, Layers } from "lucide-react";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import { useToast } from "@/components/ui/Toast";
import { exportBoard } from "@/actions/export-board";

interface DownloadBoardPDFProps {
    boardId: string;
    boardTitle: string;
}

export const DownloadBoardPDF = ({ boardId, boardTitle }: DownloadBoardPDFProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const { addToast } = useToast();
    
    // Full lists loaded dynamically from database
    const [fullLists, setFullLists] = useState<any[]>([]);
    const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
    const [exportOrder, setExportOrder] = useState<"board" | "day">("board");

    // Hydration guard to eliminate React error #418
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Load full board details when dialog is opened
    useEffect(() => {
        if (isOpen) {
            setIsLoadingData(true);
            setFullLists([]);
            exportBoard({ id: boardId })
                .then(result => {
                    if (result?.data?.lists) {
                        const lists = result.data.lists;
                        setFullLists(lists);
                        // Auto-select all lists by default
                        setSelectedListIds(new Set(lists.map((l: any) => l.id)));
                    } else {
                        addToast("No lists found on this board", "error");
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch full board details:", err);
                    addToast("Failed to load list details", "error");
                })
                .finally(() => {
                    setIsLoadingData(false);
                });
        }
    }, [isOpen, boardId]);

    if (!isMounted) return null;

    const toggleList = (id: string) => {
        const newSet = new Set(selectedListIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedListIds(newSet);
    };

    const selectAll = () => {
        setSelectedListIds(new Set(fullLists.map(l => l.id)));
    };

    const selectNone = () => {
        setSelectedListIds(new Set());
    };

    const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
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

    // Helper to extract DAY info from a list
    const getListDay = (list: any): { dayNum: number; dayLabel: string; dueDate: Date | null } | null => {
        const dayCard = list.cards?.find((c: any) => {
            const title = c.title.toUpperCase();
            return title.startsWith("DAY ") || title.startsWith("DAY#");
        });
        if (!dayCard) return null;

        const title = dayCard.title.toUpperCase();
        const match = title.match(/DAY\s*#?\s*(\d+)/i);
        const dayNum = match ? parseInt(match[1], 10) : 9999;
        
        return {
            dayNum,
            dayLabel: dayCard.title,
            dueDate: dayCard.dueDate ? new Date(dayCard.dueDate) : null
        };
    };

    const generatePDF = async () => {
        if (selectedListIds.size === 0) {
            addToast("Please select at least one list", "error");
            return;
        }

        setIsGenerating(true);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);
            
            const selectedLists = fullLists.filter(l => selectedListIds.has(l.id));
            const pdfAttachments: string[] = [];

            // Group or sort data based on Export Order
            let groupedDays: { dayNum: number; dayLabel: string; dueDate: Date | null; lists: any[] }[] = [];
            let unscheduledLists: any[] = [];

            if (exportOrder === "day") {
                const dayGroups: Record<string, { dayNum: number; dayLabel: string; dueDate: Date | null; lists: any[] }> = {};
                selectedLists.forEach(list => {
                    const dayInfo = getListDay(list);
                    if (dayInfo) {
                        const key = `day-${dayInfo.dayNum}`;
                        if (!dayGroups[key]) {
                            dayGroups[key] = {
                                dayNum: dayInfo.dayNum,
                                dayLabel: dayInfo.dayLabel,
                                dueDate: dayInfo.dueDate,
                                lists: []
                            };
                        }
                        dayGroups[key].lists.push(list);
                    } else {
                        unscheduledLists.push(list);
                    }
                });

                groupedDays = Object.values(dayGroups).sort((a, b) => {
                    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
                    return a.dayNum - b.dayNum;
                });
                
                // Sort lists within days by relative order
                groupedDays.forEach(g => g.lists.sort((a, b) => a.order - b.order));
                unscheduledLists.sort((a, b) => a.order - b.order);
            } else {
                // Default: Sort strictly by board order
                selectedLists.sort((a, b) => a.order - b.order);
            }

            // Maps to store internal links targets (page numbers)
            const pageMap: Record<string, number> = {};
            const tocPageNum = 2;

            // ==========================================
            // PAGE 1: COVER PAGE
            // ==========================================
            // Premium Slate Background Header Banner
            doc.setFillColor(30, 41, 59); // deep slate
            doc.rect(0, 0, pageWidth, 75, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.setTextColor(255, 255, 255);
            doc.text(boardTitle, margin, 40, { maxWidth: contentWidth });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text("Interactive Production Shooting Schedule & Board Export", margin, 52);

            // Metadata Card
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(margin, 90, contentWidth, 70, "F");
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.rect(margin, 90, contentWidth, 70, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text("Export Details", margin + 10, 105);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105); // slate-600
            
            const totalCards = selectedLists.reduce((sum, l) => sum + (l.cards?.length || 0), 0);
            const totalDays = exportOrder === "day" ? groupedDays.length : new Set(selectedLists.map(l => getListDay(l)?.dayNum).filter(Boolean)).size;

            doc.text(`Export Mode:   ${exportOrder === "day" ? "Day-by-Day Order" : "Default Board Order"}`, margin + 10, 118);
            doc.text(`Total Days:      ${totalDays || "N/A"}`, margin + 10, 126);
            doc.text(`Total Scenes:    ${selectedLists.length}`, margin + 10, 134);
            doc.text(`Total Tasks:     ${totalCards}`, margin + 10, 142);
            doc.text(`Exported On:    ${new Date().toLocaleString()}`, margin + 10, 150);

            // Instructions / Info
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text("This is an interactive PDF. Tap any entry in the Table of Contents on Page 2 to navigate,", margin, 240);
            doc.text("and click 'Back to Table of Contents' at the bottom of any scene page to return instantly.", margin, 246);

            // Logo Accent
            doc.setFillColor(234, 179, 8); // yellow-500
            doc.rect(margin, 72, 30, 3, "F");

            // ==========================================
            // PAGE 2: TABLE OF CONTENTS (Placeholder)
            // ==========================================
            doc.addPage();
            // We just leave page 2 active, we will return here at the very end to draw the TOC items!

            // ==========================================
            // PAGES 3+: SCENE CONTENT PAGES
            // ==========================================
            let yOffset = 20;

            const writeBackToTOCLink = (currentY: number) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(67, 56, 202); // indigo-700
                doc.text("← Back to Table of Contents", margin, pageHeight - 15);
                doc.link(margin, pageHeight - 19, 50, 6, { pageNumber: tocPageNum });
            };

            const checkPageBreak = (neededHeight: number) => {
                if (yOffset + neededHeight > pageHeight - 25) {
                    writeBackToTOCLink(yOffset);
                    doc.addPage();
                    yOffset = 20;
                    return true;
                }
                return false;
            };

            // Helper to render lists/scenes
            const renderListContent = async (list: any) => {
                checkPageBreak(30);

                const listStartPage = doc.getNumberOfPages();
                pageMap[list.id] = listStartPage;

                // Draw a styled Scene Header Card
                doc.setFillColor(241, 245, 249); // slate-100
                doc.rect(margin, yOffset, contentWidth, 12, "F");
                doc.setDrawColor(203, 213, 225); // slate-300
                doc.line(margin, yOffset, margin, yOffset + 12); // left border accent
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text(list.title, margin + 4, yOffset + 8);
                yOffset += 18;

                // Cards inside the scene
                const cards = list.cards || [];
                if (cards.length === 0) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(10);
                    doc.setTextColor(148, 163, 184);
                    doc.text("No cards or tasks in this scene.", margin + 6, yOffset);
                    yOffset += 8;
                }

                for (const card of cards) {
                    checkPageBreak(25);

                    // Skip the DAY card in the rendering list to prevent redundancy
                    if (card.title.toUpperCase().startsWith("DAY ") || card.title.toUpperCase().startsWith("DAY#")) {
                        continue;
                    }

                    // Checkbox empty square
                    doc.setDrawColor(100, 116, 139); // slate-500
                    doc.rect(margin + 6, yOffset - 3.5, 4, 4, "D");

                    // Card Title
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(11);
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text(card.title, margin + 14, yOffset);
                    yOffset += 6;

                    // Labels (pills)
                    if (card.labels && card.labels.length > 0) {
                        checkPageBreak(10);
                        let xLabel = margin + 14;
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8);
                        
                        for (const label of card.labels) {
                            const labelText = label.title.toUpperCase();
                            const textWidth = doc.getTextWidth(labelText);
                            const pillWidth = textWidth + 6;

                            // Draw badge color
                            doc.setFillColor(219, 234, 254); // light blue default
                            doc.rect(xLabel, yOffset - 3, pillWidth, 4, "F");
                            
                            doc.setTextColor(30, 58, 138);
                            doc.text(labelText, xLabel + 3, yOffset);
                            xLabel += pillWidth + 3;
                        }
                        yOffset += 6;
                    }

                    // Card Description
                    if (card.description) {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(9.5);
                        doc.setTextColor(71, 85, 105); // slate-600
                        const lines = doc.splitTextToSize(card.description, contentWidth - 14);
                        checkPageBreak(lines.length * 5 + 5);
                        doc.text(lines, margin + 14, yOffset);
                        yOffset += (lines.length * 4.5) + 4;
                    }

                    // Attachments
                    if (card.attachments && card.attachments.length > 0) {
                        for (const attach of card.attachments) {
                            checkPageBreak(12);

                            const isImage = attach.type === "IMAGE" || attach.thumbnailUrl;
                            const isGMap = attach.url.includes("google.com/maps") || attach.url.includes("maps.app.goo.gl");
                            const isPDF = attach.url.toLowerCase().endsWith(".pdf");

                            // Paperclip/link icon prefix
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(9);
                            doc.setTextColor(37, 99, 235); // blue-600

                            let linkText = `[Attachment: ${attach.title || "File"}]`;
                            if (isGMap) linkText = `[Map: View Location]`;
                            else if (isPDF) linkText = `[PDF Document: ${attach.title || "Attached"}]`;
                            else if (isImage) linkText = `[Image: ${attach.title || "Preview"}]`;

                            doc.text(linkText, margin + 14, yOffset);
                            // Make whole line interactive link
                            doc.link(margin + 14, yOffset - 3, 100, 4, { url: attach.url });

                            // Collect PDF attachments to merge later
                            if (isPDF) {
                                pdfAttachments.push(attach.url);
                            }

                            // If image, we can try base64 print
                            if (isImage && !isGMap && !attach.url.includes("drive.google.com")) {
                                const base64 = await fetchImageAsBase64(attach.url);
                                if (base64) {
                                    try {
                                        checkPageBreak(50);
                                        doc.addImage(base64, "JPEG", margin + 14, yOffset + 3, 70, 40);
                                        yOffset += 44;
                                    } catch (e) {
                                        console.error("Failed base64 print in pdf:", e);
                                    }
                                }
                            }
                            yOffset += 6;
                        }
                    }

                    yOffset += 3; // space between cards
                }

                yOffset += 8; // space after scene
            };

            // Generate content sequentially by DAY
            if (exportOrder === "day") {
                for (const group of groupedDays) {
                    // Start each Day on a fresh page
                    doc.addPage();
                    yOffset = 20;

                    const dayStartPage = doc.getNumberOfPages();
                    pageMap[`day-${group.dayNum}`] = dayStartPage;

                    // Draw Premium Day Header Banner
                    doc.setFillColor(67, 56, 202); // Indigo-700
                    doc.rect(0, 0, pageWidth, 28, "F");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(15);
                    doc.setTextColor(255, 255, 255);
                    doc.text(group.dayLabel.toUpperCase(), margin, 18);
                    
                    yOffset = 38;

                    // Day Scenes
                    for (const list of group.lists) {
                        await renderListContent(list);
                    }

                    writeBackToTOCLink(yOffset);
                }

                // Unscheduled Scenes Group
                if (unscheduledLists.length > 0) {
                    doc.addPage();
                    yOffset = 20;
                    
                    const unscheduledStartPage = doc.getNumberOfPages();
                    pageMap["unscheduled"] = unscheduledStartPage;

                    doc.setFillColor(100, 116, 139); // Slate-500
                    doc.rect(0, 0, pageWidth, 28, "F");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(15);
                    doc.setTextColor(255, 255, 255);
                    doc.text("UNSCHEDULED SCENES & LISTS", margin, 18);
                    
                    yOffset = 38;

                    for (const list of unscheduledLists) {
                        await renderListContent(list);
                    }

                    writeBackToTOCLink(yOffset);
                }
            } else {
                // Default Board Order Flow
                doc.addPage();
                yOffset = 20;

                doc.setFillColor(30, 41, 59); // deep slate
                doc.rect(0, 0, pageWidth, 28, "F");

                doc.setFont("helvetica", "bold");
                doc.setFontSize(15);
                doc.setTextColor(255, 255, 255);
                doc.text("SCENE SCHEDULING DETAILS", margin, 18);

                yOffset = 38;

                for (const list of selectedLists) {
                    await renderListContent(list);
                }

                writeBackToTOCLink(yOffset);
            }

            // ==========================================
            // BACK-DRAWING PAGE 2: TABLE OF CONTENTS
            // ==========================================
            doc.setPage(tocPageNum);

            // TOC Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.text("TABLE OF CONTENTS", margin, 25);

            doc.setFillColor(67, 56, 202); // indigo accent line
            doc.rect(margin, 28, 40, 1.5, "F");

            let tocY = 42;
            doc.setFontSize(10.5);

            if (exportOrder === "day") {
                // Group TOC by Days
                doc.setFont("helvetica", "bold");
                doc.setTextColor(71, 85, 105);
                doc.text("Shooting Days", margin, tocY);
                tocY += 8;

                const columnSplit = groupedDays.length > 15;
                let colX = margin;

                for (let i = 0; i < groupedDays.length; i++) {
                    const group = groupedDays[i];
                    const targetPage = pageMap[`day-${group.dayNum}`];
                    
                    if (columnSplit && i === Math.ceil(groupedDays.length / 2)) {
                        colX = margin + (contentWidth / 2) + 5;
                        tocY = 50; // reset column height
                    }

                    if (!targetPage) continue;

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(37, 99, 235); // Blue link
                    
                    const label = group.dayLabel;
                    const cleanLabel = label.length > 25 ? `${label.substring(0, 22)}...` : label;
                    
                    doc.text(cleanLabel, colX, tocY);
                    
                    // Draw dot lines
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(203, 213, 225);
                    const labelWidth = doc.getTextWidth(cleanLabel);
                    const dotsStartX = colX + labelWidth + 3;
                    const dotsEndX = columnSplit ? colX + (contentWidth / 2) - 8 : colX + contentWidth - 10;
                    
                    let dots = "";
                    for (let d = 0; d < Math.max(5, Math.floor((dotsEndX - dotsStartX) / 1.5)); d++) dots += ".";
                    doc.text(dots, dotsStartX, tocY);

                    // Page number
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(71, 85, 105);
                    doc.text(targetPage.toString(), dotsEndX + 2, tocY);

                    // Clickable row link
                    doc.link(colX, tocY - 4, dotsEndX - colX + 10, 5, { pageNumber: targetPage });
                    tocY += 8;
                }

                if (unscheduledLists.length > 0) {
                    const targetPage = pageMap["unscheduled"];
                    if (targetPage) {
                        tocY = Math.max(tocY, 180);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(220, 38, 38); // red link
                        doc.text("Unscheduled Scenes & Lists", margin, tocY);

                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(203, 213, 225);
                        const labelWidth = doc.getTextWidth("Unscheduled Scenes & Lists");
                        let dots = "";
                        for (let d = 0; d < Math.floor((margin + contentWidth - 10 - (margin + labelWidth + 3)) / 1.5); d++) dots += ".";
                        doc.text(dots, margin + labelWidth + 3, tocY);

                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(71, 85, 105);
                        doc.text(targetPage.toString(), margin + contentWidth - 8, tocY);

                        doc.link(margin, tocY - 4, contentWidth, 5, { pageNumber: targetPage });
                    }
                }
            } else {
                // Board Order TOC (List of Scenes)
                doc.setFont("helvetica", "bold");
                doc.setTextColor(71, 85, 105);
                doc.text("Board Scenes & Lists", margin, tocY);
                tocY += 8;

                const columnSplit = selectedLists.length > 15;
                let colX = margin;

                for (let i = 0; i < selectedLists.length; i++) {
                    const list = selectedLists[i];
                    const targetPage = pageMap[list.id];

                    if (columnSplit && i === Math.ceil(selectedLists.length / 2)) {
                        colX = margin + (contentWidth / 2) + 5;
                        tocY = 50;
                    }

                    if (!targetPage) continue;

                    doc.setFont("helvetica", "medium");
                    doc.setTextColor(37, 99, 235);
                    
                    const cleanTitle = list.title.length > 25 ? `${list.title.substring(0, 22)}...` : list.title;
                    doc.text(cleanTitle, colX, tocY);

                    // Draw dots
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(203, 213, 225);
                    const labelWidth = doc.getTextWidth(cleanTitle);
                    const dotsStartX = colX + labelWidth + 3;
                    const dotsEndX = columnSplit ? colX + (contentWidth / 2) - 8 : colX + contentWidth - 10;
                    
                    let dots = "";
                    for (let d = 0; d < Math.max(5, Math.floor((dotsEndX - dotsStartX) / 1.5)); d++) dots += ".";
                    doc.text(dots, dotsStartX, tocY);

                    // Page number
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(71, 85, 105);
                    doc.text(targetPage.toString(), dotsEndX + 2, tocY);

                    // Clickable link
                    doc.link(colX, tocY - 4, dotsEndX - colX + 10, 5, { pageNumber: targetPage });
                    tocY += 8;
                }
            }

            // ==========================================
            // COMPILING & ATTACHMENT MERGING
            // ==========================================
            const mainPdfBytes = doc.output("arraybuffer");
            let finalPdfBytes = mainPdfBytes;

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

            // Download Trigger
            const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `${boardTitle.replace(/\s+/g, '-').toLowerCase()}-export.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            addToast("Interactive PDF Generated Successfully", "success");
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
                            <span className="font-bold text-sm text-neutral-700 font-sans">Interactive PDF Export</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Export Order Switcher */}
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Export Order</label>
                            <div className="flex bg-neutral-100 rounded-lg p-0.5 border border-neutral-200">
                                <button
                                    onClick={() => setExportOrder("board")}
                                    className={`flex-1 flex items-center justify-center gap-x-1.5 py-1.5 rounded-md text-xs font-bold transition ${exportOrder === "board" ? 'bg-white text-slate-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                                >
                                    <Layers className="h-3.5 w-3.5" />
                                    Board Order
                                </button>
                                <button
                                    onClick={() => setExportOrder("day")}
                                    className={`flex-1 flex items-center justify-center gap-x-1.5 py-1.5 rounded-md text-xs font-bold transition ${exportOrder === "day" ? 'bg-white text-indigo-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    Day Order
                                </button>
                            </div>
                        </div>

                        {/* List Selector Box */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Select Scenes</label>
                                <div className="flex items-center gap-x-2">
                                    <button onClick={selectAll} className="text-[9px] font-bold text-indigo-600 hover:underline">All</button>
                                    <span className="text-[9px] text-neutral-300">|</span>
                                    <button onClick={selectNone} className="text-[9px] font-bold text-neutral-600 hover:underline">None</button>
                                </div>
                            </div>

                            {isLoadingData ? (
                                <div className="h-[200px] border border-neutral-100 rounded-lg flex flex-col items-center justify-center gap-y-2 bg-neutral-50/50">
                                    <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                                    <span className="text-xs text-neutral-400 font-medium">Loading board details...</span>
                                </div>
                            ) : (
                                <div className="max-h-[200px] overflow-y-auto space-y-1 border border-neutral-200 rounded-lg p-2 bg-neutral-50/30">
                                    {fullLists.map(list => (
                                        <div 
                                            key={list.id}
                                            onClick={() => toggleList(list.id)}
                                            className={`flex items-center gap-x-3 px-2 py-1.5 rounded-md cursor-pointer transition ${selectedListIds.has(list.id) ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-neutral-50 text-neutral-600'}`}
                                        >
                                            <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selectedListIds.has(list.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-300'}`}>
                                                {selectedListIds.has(list.id) && <div className="h-1 w-1 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-xs font-semibold truncate flex-1 text-left">{list.title}</span>
                                            <span className="text-[9px] opacity-60">({list.cards?.length || 0})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Download Action Button */}
                        <button
                            onClick={generatePDF}
                            disabled={isGenerating || isLoadingData || selectedListIds.size === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white rounded-md py-2.5 text-sm font-bold shadow-md shadow-indigo-100 transition flex items-center justify-center gap-x-2 cursor-pointer"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating PDF...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Download {selectedListIds.size} Lists as PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
