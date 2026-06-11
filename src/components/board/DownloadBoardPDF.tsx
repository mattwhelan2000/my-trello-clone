"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Download, FileText, CheckSquare, Square, Loader2, X, Calendar, Layers, Image as ImageIcon, File, Map, FolderArchive } from "lucide-react";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/components/ui/Toast";
import { formatImageUrl } from "@/lib/format-image-url";
import { exportBoard } from "@/actions/export-board";
import { useBoardStore } from "@/hooks/use-board-store";

interface DownloadBoardPDFProps {
    boardId: string;
    boardTitle: string;
}

export const DownloadBoardPDF = ({ boardId, boardTitle }: DownloadBoardPDFProps) => {
    const { 
        query: searchQuery, 
        searchCards, 
        searchLists, 
        searchInvert, 
        selectedLabels,
        isFilterEnabled
    } = useBoardStore();

    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    // Progress state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const [isLoadingData, setIsLoadingData] = useState(false);
    const { addToast } = useToast();
    
    const [fullLists, setFullLists] = useState<any[]>([]);
    const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
    const [exportOrder, setExportOrder] = useState<"board" | "day">("board");

    // Options
    const [includeImages, setIncludeImages] = useState(true);
    const [includePDFs, setIncludePDFs] = useState(true);

    const [boardLabels, setBoardLabels] = useState<{ id: string; title: string; color: string }[]>([]);
    const [selectedExportLabels, setSelectedExportLabels] = useState<Set<string>>(new Set());

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsLoadingData(true);
            setFullLists([]);
            fetch(`/api/boards/${boardId}/labels`)
                .then(res => res.ok ? res.json() : [])
                .then(data => setBoardLabels(data))
                .catch(console.error);

            exportBoard({ id: boardId })
                .then(result => {
                    if (result?.data?.lists) {
                        const lists = result.data.lists;
                        setFullLists(lists);
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

    const isCardVisible = (card: any, listTitle: string) => {
        const query = (searchQuery || "").toLowerCase().trim();
        const terms = query.split(',').map(t => t.trim()).filter(t => t !== "");
        const isFilterActive = isFilterEnabled && (terms.length > 0 || selectedLabels.size > 0);

        if (!isFilterActive) return true;
        if (card.title.toUpperCase().startsWith("DAY ") || card.title.toUpperCase().startsWith("DAY#")) return true;

        const isListMatch = searchLists && terms.length > 0 && terms.every(term => listTitle.toLowerCase().includes(term));
        let matchesLabels = selectedLabels.size === 0 || (card.labels && card.labels.some((l: any) => selectedLabels.has(l.title)));
        let matchesSearch = true;
        
        if (terms.length > 0) {
            const isCardMatch = searchCards && terms.every(term => 
                card.title.toLowerCase().includes(term) ||
                (card.description && card.description.toLowerCase().includes(term))
            );
            matchesSearch = isListMatch || isCardMatch;
        }

        let isVisible = matchesLabels && matchesSearch;
        
        if (searchInvert && (terms.length > 0 || selectedLabels.size > 0)) {
            isVisible = !isVisible;
        }
        return isVisible;
    };

    const filteredFullLists = useMemo(() => {
        return fullLists.map(list => ({
            ...list,
            cards: list.cards ? list.cards.filter((card: any) => isCardVisible(card, list.title)) : []
        }));
    }, [fullLists, searchQuery, searchCards, searchLists, searchInvert, selectedLabels, isFilterEnabled]);

    // UI Grouping
    const displayGroups = useMemo(() => {
        if (exportOrder === "board") {
            return [{ label: "All Scenes (Board Order)", lists: [...filteredFullLists].sort((a,b) => a.order - b.order) }];
        } else {
            const dayGroups: Record<string, { dayNum: number; dayLabel: string; dueDate: Date | null; lists: any[] }> = {};
            const unscheduledLists: any[] = [];
            
            filteredFullLists.forEach(list => {
                const dayInfo = getListDay(list);
                if (dayInfo) {
                    const key = `day-${dayInfo.dayNum}`;
                    if (!dayGroups[key]) {
                        dayGroups[key] = { dayNum: dayInfo.dayNum, dayLabel: dayInfo.dayLabel, dueDate: dayInfo.dueDate, lists: [] };
                    }
                    dayGroups[key].lists.push(list);
                } else {
                    unscheduledLists.push(list);
                }
            });

            const sortedGroups = Object.values(dayGroups).sort((a, b) => {
                if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
                return a.dayNum - b.dayNum;
            });
            
            sortedGroups.forEach(g => g.lists.sort((a, b) => a.order - b.order));
            unscheduledLists.sort((a, b) => a.order - b.order);
            
            const result = sortedGroups.map(g => ({ key: `day-${g.dayNum}`, label: g.dayLabel, lists: g.lists }));
            if (unscheduledLists.length > 0) result.push({ key: "unscheduled", label: "Unscheduled Scenes", lists: unscheduledLists });
            return result;
        }
    }, [filteredFullLists, exportOrder]);

    if (!isMounted) return null;

    const toggleList = (id: string) => {
        const newSet = new Set(selectedListIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedListIds(newSet);
    };

    const selectAll = () => setSelectedListIds(new Set(filteredFullLists.map(l => l.id)));
    const selectNone = () => setSelectedListIds(new Set());

    const toggleDayGroup = (lists: any[]) => {
        const listIds = lists.map(l => l.id);
        const allSelected = listIds.every(id => selectedListIds.has(id));
        const newSet = new Set(selectedListIds);
        
        if (allSelected) {
            listIds.forEach(id => newSet.delete(id));
        } else {
            listIds.forEach(id => newSet.add(id));
        }
        setSelectedListIds(newSet);
    };

    const toggleExportLabel = (labelTitle: string) => {
        const newSet = new Set(selectedExportLabels);
        if (newSet.has(labelTitle)) newSet.delete(labelTitle);
        else newSet.add(labelTitle);
        setSelectedExportLabels(newSet);
    };

    const yieldToRender = () => new Promise(resolve => setTimeout(resolve, 5));

    const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
            let fetchUrl = url;
            const formatted = formatImageUrl(url);
            if (formatted) {
                fetchUrl = formatted;
            }

            // Only proxy if it's not already proxied
            if (!fetchUrl.startsWith('/') && !fetchUrl.includes('/api/proxy-image')) {
                fetchUrl = `/api/proxy-image?url=${encodeURIComponent(fetchUrl)}`;
            }

            const response = await fetch(fetchUrl);
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
            let fetchUrl = url;
            const formatted = formatImageUrl(url);
            if (formatted) fetchUrl = formatted;

            if (!fetchUrl.startsWith('/') && !fetchUrl.includes('/api/proxy-image')) {
                fetchUrl = `/api/proxy-image?url=${encodeURIComponent(fetchUrl)}`;
            }

            const response = await fetch(fetchUrl);
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
        setGenerationStatus("Initializing document...");
        setProgress({ current: 0, total: 0 });
        await yieldToRender();

        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);
            
            const selectedLists = filteredFullLists.filter(l => selectedListIds.has(l.id));
            // Pre-calculate items to download for progress
            let totalImagesToDownload = 0;
            let totalPdfsToDownload = 0;
            for (const list of selectedLists) {
                for (const card of list.cards || []) {
                    if (card.title.toUpperCase().startsWith("DAY ") || card.title.toUpperCase().startsWith("DAY#")) continue;
                    
                    // Note: only counting if the card has a selected label (since we only download if selected)
                    const hasSelectedLabel = selectedExportLabels.size === 0 || card.labels?.some((l: any) => selectedExportLabels.has(l.title));
                    if (!hasSelectedLabel && selectedExportLabels.size > 0) continue;

                    for (const attach of card.attachments || []) {
                        const isPDF = attach.url.toLowerCase().endsWith(".pdf") || attach.url.toLowerCase().includes("pdf");
                        const isImage = attach.type === "IMAGE" || !!attach.thumbnailUrl || attach.url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) !== null || ((attach.url.includes("dropbox.com") || attach.url.includes("drive.google.com")) && !isPDF);
                        const isGMap = attach.url.includes("google.com/maps") || attach.url.includes("maps.app.goo.gl");
                        
                        if (includeImages && isImage && !isGMap) totalImagesToDownload++;
                        if (includePDFs && isPDF) totalPdfsToDownload++;
                    }
                }
            }

            let imagesDownloaded = 0;
            let pdfsDownloaded = 0;

            let runningPdfPageCount = 0;
            const listPdfOffsetMap: Record<string, number> = {};
            const pdfAttachmentsToInsert: { insertAfterJsPdfPage: number; buffer: ArrayBuffer }[] = [];

            let groupedDays: { dayNum: number; dayLabel: string; dueDate: Date | null; lists: any[] }[] = [];
            let unscheduledLists: any[] = [];
            let activeGroupForName: string | null = null;

            if (exportOrder === "day") {
                const dayGroups: Record<string, { dayNum: number; dayLabel: string; dueDate: Date | null; lists: any[] }> = {};
                selectedLists.forEach(list => {
                    const dayInfo = getListDay(list);
                    if (dayInfo) {
                        const key = `day-${dayInfo.dayNum}`;
                        if (!dayGroups[key]) {
                            dayGroups[key] = { dayNum: dayInfo.dayNum, dayLabel: dayInfo.dayLabel, dueDate: dayInfo.dueDate, lists: [] };
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
                
                groupedDays.forEach(g => g.lists.sort((a, b) => a.order - b.order));
                unscheduledLists.sort((a, b) => a.order - b.order);

                // Determine active group for naming
                const activeGroups = [...groupedDays, { dayLabel: "Unscheduled", lists: unscheduledLists }].filter(g => g.lists.some(l => selectedListIds.has(l.id)));
                if (activeGroups.length === 1 && activeGroups[0].dayLabel !== "Unscheduled") {
                    activeGroupForName = activeGroups[0].dayLabel;
                }
            } else {
                selectedLists.sort((a, b) => a.order - b.order);
            }

            const pageMap: Record<string, number> = {};
            const tocPageNum = 2;

            // PAGE 1: COVER PAGE
            setGenerationStatus("Creating cover page...");
            await yieldToRender();

            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pageWidth, 75, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.setTextColor(255, 255, 255);
            doc.text(boardTitle, margin, 40, { maxWidth: contentWidth });
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(148, 163, 184);
            doc.text("Interactive Production Shooting Schedule & Board Export", margin, 52);

            doc.setFillColor(248, 250, 252);
            doc.rect(margin, 90, contentWidth, 70, "F");
            doc.setDrawColor(226, 232, 240);
            doc.rect(margin, 90, contentWidth, 70, "D");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(30, 41, 59);
            doc.text("Export Details", margin + 10, 105);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(71, 85, 105);
            
            const totalCards = selectedLists.reduce((sum, l) => sum + (l.cards?.length || 0), 0);
            const totalDays = exportOrder === "day" ? groupedDays.length : new Set(selectedLists.map(l => getListDay(l)?.dayNum).filter(Boolean)).size;

            doc.text(`Export Mode:   ${exportOrder === "day" ? "Day-by-Day Order" : "Default Board Order"}`, margin + 10, 118);
            doc.text(`Total Days:      ${totalDays || "N/A"}`, margin + 10, 126);
            doc.text(`Total Scenes:    ${selectedLists.length}`, margin + 10, 134);
            doc.text(`Total Tasks:     ${totalCards}`, margin + 10, 142);
            doc.text(`Exported On:    ${new Date().toLocaleString()}`, margin + 10, 150);

            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(148, 163, 184);
            doc.text("This is an interactive PDF. Tap any entry in the Table of Contents on Page 2 to navigate,", margin, 240);
            doc.text("and click 'Back to Table of Contents' at the bottom of any scene page to return instantly.", margin, 246);

            doc.setFillColor(234, 179, 8);
            doc.rect(margin, 72, 30, 3, "F");

            // PAGE 2: TABLE OF CONTENTS (Placeholder)
            doc.addPage();

            // PAGES 3+: SCENE CONTENT PAGES
            let yOffset = 20;

            const writeBackToTOCLink = (currentY: number) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(67, 56, 202);
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

            const renderListContent = async (list: any) => {
                setGenerationStatus(`Rendering scene: ${list.title}...`);
                await yieldToRender();

                checkPageBreak(30);

                const listStartPage = doc.getNumberOfPages();
                pageMap[list.id] = listStartPage;
                listPdfOffsetMap[list.id] = runningPdfPageCount;
                let currentListPdfBuffers: ArrayBuffer[] = [];

                doc.setFillColor(241, 245, 249);
                doc.rect(margin, yOffset, contentWidth, 12, "F");
                doc.setDrawColor(203, 213, 225);
                doc.line(margin, yOffset, margin, yOffset + 12);
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.setTextColor(30, 41, 59);
                doc.text(list.title, margin + 4, yOffset + 8);
                yOffset += 18;

                const cards = list.cards || [];
                if (cards.length === 0) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(10);
                    doc.setTextColor(148, 163, 184);
                    doc.text("No cards or tasks in this scene.", margin + 6, yOffset);
                    yOffset += 8;
                }

                // --- SCENE SUMMARY ---
                if (cards.length > 0) {
                    const nonDayCards = cards.filter((c: any) => !(c.title.toUpperCase().startsWith("DAY ") || c.title.toUpperCase().startsWith("DAY#")));
                    
                    if (nonDayCards.length > 0) {
                        doc.setFillColor(250, 250, 250);
                        doc.setDrawColor(226, 232, 240);
                        
                        // Estimate height: header + lines
                        const summaryHeight = 6 + (nonDayCards.length * 5) + 4;
                        checkPageBreak(summaryHeight);

                        doc.rect(margin + 4, yOffset, contentWidth - 8, summaryHeight, "FD");
                        
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184);
                        doc.text("SCENE SUMMARY:", margin + 8, yOffset + 5);
                        let summaryY = yOffset + 10;
                        
                        for (const card of nonDayCards) {
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(9);
                            doc.setTextColor(51, 65, 85);
                            doc.text(`• ${card.title}`, margin + 8, summaryY);
                            
                            // Draw tiny labels next to it
                            let lX = margin + 8 + doc.getTextWidth(`• ${card.title}`) + 4;
                            if (card.labels && card.labels.length > 0) {
                                for (const label of card.labels) {
                                    const lText = label.title.toUpperCase();
                                    const lWidth = doc.getTextWidth(lText) + 4;
                                    doc.setFillColor(226, 232, 240);
                                    doc.rect(lX, summaryY - 2.5, lWidth, 3.5, "F");
                                    doc.setFont("helvetica", "bold");
                                    doc.setFontSize(6);
                                    doc.setTextColor(100, 116, 139);
                                    doc.text(lText, lX + 2, summaryY);
                                    lX += lWidth + 2;
                                }
                            }
                            summaryY += 5;
                        }
                        yOffset += summaryHeight + 8;
                    }
                }

                // --- DETAILED CARD CONTENTS ---
                if (selectedExportLabels.size > 0) {
                    let hasPrintedDetailsHeader = false;

                    for (const card of cards) {
                        if (card.title.toUpperCase().startsWith("DAY ") || card.title.toUpperCase().startsWith("DAY#")) continue;

                        const hasSelectedLabel = card.labels?.some((l: any) => selectedExportLabels.has(l.title));
                        if (!hasSelectedLabel) continue;

                        if (!hasPrintedDetailsHeader) {
                            checkPageBreak(15);
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(10);
                            doc.setTextColor(30, 41, 59);
                            doc.text("DETAILED CONTENTS", margin + 6, yOffset);
                            doc.setDrawColor(226, 232, 240);
                            doc.line(margin + 6, yOffset + 2, margin + contentWidth - 6, yOffset + 2);
                            yOffset += 10;
                            hasPrintedDetailsHeader = true;
                        }

                        checkPageBreak(25);
                        doc.setDrawColor(99, 102, 241);
                        doc.rect(margin + 6, yOffset - 3.5, 4, 4, "D");

                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(11);
                        doc.setTextColor(15, 23, 42);
                        doc.text(card.title, margin + 14, yOffset);
                        yOffset += 6;

                        if (card.labels && card.labels.length > 0) {
                            checkPageBreak(10);
                            let xLabel = margin + 14;
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(8);
                            
                            for (const label of card.labels) {
                                const labelText = label.title.toUpperCase();
                                const textWidth = doc.getTextWidth(labelText);
                                const pillWidth = textWidth + 6;

                                doc.setFillColor(219, 234, 254);
                                doc.rect(xLabel, yOffset - 3, pillWidth, 4, "F");
                                
                                doc.setTextColor(30, 58, 138);
                                doc.text(labelText, xLabel + 3, yOffset);
                                xLabel += pillWidth + 3;
                            }
                            yOffset += 6;
                        }

                    if (card.description) {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(9.5);
                        doc.setTextColor(71, 85, 105);
                        const lines = doc.splitTextToSize(card.description, contentWidth - 14);
                        checkPageBreak(lines.length * 5 + 5);
                        doc.text(lines, margin + 14, yOffset);
                        yOffset += (lines.length * 4.5) + 4;
                    }

                    if (card.checklists && card.checklists.length > 0) {
                        for (const checklist of card.checklists) {
                            checkPageBreak(15);
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(9.5);
                            doc.setTextColor(71, 85, 105);
                            doc.text(checklist.title.toUpperCase(), margin + 14, yOffset);
                            yOffset += 5;

                            if (checklist.items && checklist.items.length > 0) {
                                doc.setFont("helvetica", "normal");
                                doc.setFontSize(9);
                                doc.setTextColor(15, 23, 42);
                                
                                for (const item of checklist.items) {
                                    checkPageBreak(10);
                                    doc.setDrawColor(148, 163, 184);
                                    if (item.isCompleted) {
                                        doc.rect(margin + 16, yOffset - 2.5, 3, 3, "F"); // Filled checkbox
                                    } else {
                                        doc.rect(margin + 16, yOffset - 2.5, 3, 3, "D"); // Empty checkbox
                                    }
                                    
                                    const lines = doc.splitTextToSize(item.title, contentWidth - 22);
                                    doc.text(lines, margin + 21, yOffset);
                                    yOffset += (lines.length * 4) + 2;
                                }
                            }
                            yOffset += 2;
                        }
                    }

                    if (card.attachments && card.attachments.length > 0) {
                        for (const attach of card.attachments) {
                            checkPageBreak(12);

                            const isPDF = attach.url.toLowerCase().endsWith(".pdf") || attach.url.toLowerCase().includes("pdf");
                            const isImage = attach.type === "IMAGE" || !!attach.thumbnailUrl || attach.url.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) !== null || ((attach.url.includes("dropbox.com") || attach.url.includes("drive.google.com")) && !isPDF);
                            const isGMap = attach.url.includes("google.com/maps") || attach.url.includes("maps.app.goo.gl");

                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(9);
                            doc.setTextColor(37, 99, 235);

                            let linkText = `[Attachment: ${attach.title || "File"}]`;
                            if (isGMap) linkText = `[Map: View Location]`;
                            else if (isPDF) linkText = `[PDF Document: ${attach.title || "Attached"}]`;
                            else if (isImage) linkText = `[Image: ${attach.title || "Preview"}]`;

                            doc.text(linkText, margin + 14, yOffset);
                            doc.link(margin + 14, yOffset - 3, 100, 4, { url: attach.url });

                            if (includePDFs && isPDF) {
                                pdfsDownloaded++;
                                setGenerationStatus(`Downloading PDF ${pdfsDownloaded} of ${totalPdfsToDownload}...`);
                                setProgress({ current: pdfsDownloaded, total: totalPdfsToDownload });
                                await yieldToRender();

                                const buffer = await downloadPdfBuffer(attach.url);
                                if (buffer) {
                                    try {
                                        const attachDoc = await PDFDocument.load(buffer);
                                        const numPages = attachDoc.getPageCount();
                                        currentListPdfBuffers.push(buffer);
                                        runningPdfPageCount += numPages;
                                    } catch (e) {
                                        console.warn("Invalid PDF, skipping", e);
                                    }
                                }
                            }

                            if (includeImages && isImage && !isGMap) {
                                imagesDownloaded++;
                                setGenerationStatus(`Downloading image ${imagesDownloaded} of ${totalImagesToDownload}...`);
                                setProgress({ current: imagesDownloaded, total: totalImagesToDownload });
                                await yieldToRender();

                                const base64 = await fetchImageAsBase64(attach.url);
                                if (base64) {
                                    try {
                                        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
                                            const img = new window.Image();
                                            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                                            img.onerror = () => resolve({ width: 0, height: 0 });
                                            img.src = base64;
                                        });

                                        const match = base64.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
                                        let format = match ? match[1].toUpperCase() : "JPEG";
                                        if (format === "JPG") format = "JPEG";

                                        let drawWidth = 70;
                                        let drawHeight = 40;

                                        if (dims.width && dims.height) {
                                            const maxWidth = 140; // Allow it to be a bit wider
                                            const maxHeight = 100;
                                            const ratio = dims.width / dims.height;

                                            drawWidth = maxWidth;
                                            drawHeight = maxWidth / ratio;

                                            if (drawHeight > maxHeight) {
                                                drawHeight = maxHeight;
                                                drawWidth = maxHeight * ratio;
                                            }
                                        }

                                        checkPageBreak(drawHeight + 10);
                                        doc.addImage(base64, format, margin + 14, yOffset + 3, drawWidth, drawHeight);
                                        yOffset += drawHeight + 4;
                                    } catch (e) {
                                        console.warn("Failed base64 print in pdf, skipping image...", e);
                                    }
                                } else {
                                    console.warn("Image download failed, skipping...");
                                }
                            }
                            yOffset += 6;
                        }
                    }
                }
                yOffset += 6;
            }

                if (currentListPdfBuffers.length > 0) {
                    const insertAfter = doc.getNumberOfPages();
                    for (const buf of currentListPdfBuffers) {
                        pdfAttachmentsToInsert.push({ insertAfterJsPdfPage: insertAfter, buffer: buf });
                    }
                    // Force the next scene to start on a new page so these PDFs appear cleanly after the current scene
                    doc.addPage();
                    yOffset = 20;
                }
            };

            if (exportOrder === "day") {
                for (const group of groupedDays) {
                    doc.addPage();
                    yOffset = 20;

                    pageMap[`day-${group.dayNum}`] = doc.getNumberOfPages();

                    doc.setFillColor(67, 56, 202);
                    doc.rect(0, 0, pageWidth, 28, "F");

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(15);
                    doc.setTextColor(255, 255, 255);
                    doc.text(group.dayLabel.toUpperCase(), margin, 18);
                    
                    yOffset = 38;

                    for (const list of group.lists) {
                        await renderListContent(list);
                    }
                    writeBackToTOCLink(yOffset);
                }

                if (unscheduledLists.length > 0) {
                    doc.addPage();
                    yOffset = 20;
                    
                    pageMap["unscheduled"] = doc.getNumberOfPages();

                    doc.setFillColor(100, 116, 139);
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
                doc.addPage();
                yOffset = 20;

                doc.setFillColor(30, 41, 59);
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

            // BACK-DRAWING PAGE 2: TABLE OF CONTENTS
            setGenerationStatus("Writing Table of Contents...");
            await yieldToRender();
            doc.setPage(tocPageNum);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.text("TABLE OF CONTENTS", margin, 25);

            doc.setFillColor(67, 56, 202);
            doc.rect(margin, 28, 40, 1.5, "F");

            let tocY = 42;
            doc.setFontSize(10.5);

            if (exportOrder === "day") {
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
                        tocY = 50;
                    }

                    if (!targetPage) continue;

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(37, 99, 235);
                    
                    const label = group.dayLabel;
                    const cleanLabel = label.length > 25 ? `${label.substring(0, 22)}...` : label;
                    doc.text(cleanLabel, colX, tocY);
                    
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(203, 213, 225);
                    const labelWidth = doc.getTextWidth(cleanLabel);
                    const dotsStartX = colX + labelWidth + 3;
                    const dotsEndX = columnSplit ? colX + (contentWidth / 2) - 8 : colX + contentWidth - 10;
                    
                    let dots = "";
                    for (let d = 0; d < Math.max(5, Math.floor((dotsEndX - dotsStartX) / 1.5)); d++) dots += ".";
                    doc.text(dots, dotsStartX, tocY);

                    // To calculate display page: we need the offset for the very first list in this day group
                    const firstListInGroup = group.lists[0];
                    let displayPage = targetPage;
                    if (firstListInGroup && listPdfOffsetMap[firstListInGroup.id] !== undefined) {
                        displayPage = targetPage + listPdfOffsetMap[firstListInGroup.id];
                    }

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(71, 85, 105);
                    doc.text(displayPage.toString(), dotsEndX + 2, tocY);

                    doc.link(colX, tocY - 4, dotsEndX - colX + 10, 5, { pageNumber: targetPage });
                    tocY += 8;
                }

                if (unscheduledLists.length > 0) {
                    const targetPage = pageMap["unscheduled"];
                    if (targetPage) {
                        tocY = Math.max(tocY, 180);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(220, 38, 38);
                        doc.text("Unscheduled Scenes & Lists", margin, tocY);

                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(203, 213, 225);
                        const labelWidth = doc.getTextWidth("Unscheduled Scenes & Lists");
                        let dots = "";
                        for (let d = 0; d < Math.floor((margin + contentWidth - 10 - (margin + labelWidth + 3)) / 1.5); d++) dots += ".";
                        doc.text(dots, margin + labelWidth + 3, tocY);

                        const firstUnscheduled = unscheduledLists[0];
                        let displayPage = targetPage;
                        if (firstUnscheduled && listPdfOffsetMap[firstUnscheduled.id] !== undefined) {
                            displayPage = targetPage + listPdfOffsetMap[firstUnscheduled.id];
                        }

                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(71, 85, 105);
                        doc.text(displayPage.toString(), margin + contentWidth - 8, tocY);

                        doc.link(margin, tocY - 4, contentWidth, 5, { pageNumber: targetPage });
                    }
                }
            } else {
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

                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(203, 213, 225);
                    const labelWidth = doc.getTextWidth(cleanTitle);
                    const dotsStartX = colX + labelWidth + 3;
                    const dotsEndX = columnSplit ? colX + (contentWidth / 2) - 8 : colX + contentWidth - 10;
                    
                    let dots = "";
                    for (let d = 0; d < Math.max(5, Math.floor((dotsEndX - dotsStartX) / 1.5)); d++) dots += ".";
                    doc.text(dots, dotsStartX, tocY);

                    const displayPage = targetPage + (listPdfOffsetMap[list.id] || 0);

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(71, 85, 105);
                    doc.text(displayPage.toString(), dotsEndX + 2, tocY);

                    doc.link(colX, tocY - 4, dotsEndX - colX + 10, 5, { pageNumber: targetPage });
                    tocY += 8;
                }
            }

            // COMPILING & ATTACHMENT MERGING
            const mainPdfBytes = doc.output("arraybuffer");
            let finalPdfBytes: any = mainPdfBytes;

            if (pdfAttachmentsToInsert.length > 0) {
                setGenerationStatus("Interleaving PDF attachments...");
                setProgress({ current: 0, total: pdfAttachmentsToInsert.length });
                await yieldToRender();
                
                try {
                    const mergedPdf = await PDFDocument.create();
                    const mainDoc = await PDFDocument.load(mainPdfBytes);
                    const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());

                    let mergedCount = 0;
                    for (let i = 0; i < mainPages.length; i++) {
                        // 1. Add the main jsPDF page
                        mergedPdf.addPage(mainPages[i]);
                        
                        // 2. Add any PDF attachments that belong AFTER this main jsPDF page (1-indexed)
                        const attachmentsAfterThisPage = pdfAttachmentsToInsert.filter(a => a.insertAfterJsPdfPage === (i + 1));
                        
                        for (const attach of attachmentsAfterThisPage) {
                            mergedCount++;
                            setGenerationStatus(`Merging PDF attachment ${mergedCount} of ${pdfAttachmentsToInsert.length}...`);
                            setProgress({ current: mergedCount, total: pdfAttachmentsToInsert.length });
                            await yieldToRender();

                            try {
                                const attachDoc = await PDFDocument.load(attach.buffer);
                                const attachPages = await mergedPdf.copyPages(attachDoc, attachDoc.getPageIndices());
                                attachPages.forEach(p => mergedPdf.addPage(p));
                            } catch (e) {
                                console.warn("Failed to merge PDF fragment, continuing...", e);
                            }
                        }
                    }

                    setGenerationStatus("Finalizing merged document...");
                    await yieldToRender();
                    finalPdfBytes = await mergedPdf.save();
                } catch (mergeError) {
                    console.error("Failed core merge process, falling back to basic PDF", mergeError);
                }
            }

            setGenerationStatus("Preparing file download...");
            await yieldToRender();

            const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            
            let finalFilename = `${boardTitle.replace(/\s+/g, '-').toLowerCase()}-export.pdf`;
            if (activeGroupForName) {
                finalFilename = `${activeGroupForName.replace(/\s+/g, '-').toLowerCase()}-export.pdf`;
            }

            link.href = downloadUrl;
            link.download = finalFilename;
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
            setGenerationStatus("");
        }
    };

    const generateZIP = async () => {
        setIsGenerating(true);
        setGenerationStatus("Initializing ZIP...");
        
        try {
            const zip = new JSZip();
            const safeBoardTitle = boardTitle.replace(/[^a-z0-9_-]/gi, '_');
            const boardFolder = zip.folder(safeBoardTitle);
            if (!boardFolder) throw new Error("Could not create board folder");

            const selectedLists = filteredFullLists.filter((l: any) => selectedListIds.has(l.id));
            
            // Loop through selected lists
            for (let i = 0; i < selectedLists.length; i++) {
                const list = selectedLists[i];
                const listName = `LIST_${String(list.order).padStart(3, '0')}_${list.title.replace(/[^a-z0-9_-]/gi, '_')}`;
                const listFolder = boardFolder.folder(listName);
                if (!listFolder) continue;

                setGenerationStatus(`Processing list: ${list.title}`);
                setProgress({ current: i, total: selectedLists.length });
                await new Promise(r => setTimeout(r, 10)); // Yield

                const cards = list.cards || [];
                for (let j = 0; j < cards.length; j++) {
                    const card = cards[j];
                    const hasSelectedLabel = selectedExportLabels.size === 0 || card.labels?.some((l: any) => selectedExportLabels.has(l.title));
                    if (!hasSelectedLabel && selectedExportLabels.size > 0) continue;

                    const cardName = `CARD_${String(card.order).padStart(3, '0')}_${card.title.replace(/[^a-z0-9_-]/gi, '_')}`;
                    const cardFolder = listFolder.folder(cardName);
                    if (!cardFolder) continue;

                    // Create card.json
                    const cardJson = JSON.stringify({
                        id: card.id,
                        title: card.title,
                        description: card.description,
                        order: card.order,
                        dueDate: card.dueDate,
                        labels: card.labels?.map((l: any) => ({ title: l.title, color: l.color })),
                        checklists: card.checklists?.map((cl: any) => ({
                            title: cl.title,
                            items: cl.items?.map((item: any) => ({ title: item.title, isCompleted: item.isCompleted }))
                        })),
                    }, null, 2);
                    
                    cardFolder.file("card.json", cardJson);

                    // Download Attachments
                    if (card.attachments && card.attachments.length > 0) {
                        for (let a = 0; a < card.attachments.length; a++) {
                            const attach = card.attachments[a];
                            const isImage = !!attach.url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/);
                            const isPDF = attach.url.toLowerCase().endsWith(".pdf");
                            
                            // Only include what the user selected in the UI options
                            if ((isImage && !includeImages) || (isPDF && !includePDFs)) continue;

                            try {
                                const attachRes = await fetch(attach.url);
                                if (!attachRes.ok) throw new Error(`Failed to fetch ${attach.url}`);
                                const blob = await attachRes.blob();
                                
                                // Best effort filename
                                let filename = attach.url.split('/').pop() || `attachment_${a}`;
                                if (filename.includes('?')) filename = filename.split('?')[0];
                                
                                cardFolder.file(filename, blob);
                            } catch (e) {
                                console.warn(`Failed to download attachment for ${card.title}`, e);
                            }
                        }
                    }
                }
            }

            setGenerationStatus("Compressing ZIP file...");
            await new Promise(r => setTimeout(r, 10)); // Yield
            
            const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
                setGenerationStatus(`Compressing: ${Math.round(metadata.percent)}%`);
            });

            let finalFilename = `${safeBoardTitle}-export.zip`;
            saveAs(content, finalFilename);
            
            addToast("ZIP Downloaded Successfully", "success");
            setIsOpen(false);
        } catch (error) {
            console.error("ZIP Generation Error:", error);
            addToast("Failed to generate ZIP", "error");
        } finally {
            setIsGenerating(false);
            setGenerationStatus("");
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-black/20 hover:bg-black/30 text-white rounded-md px-3 py-1.5 flex items-center gap-x-2 text-sm font-medium backdrop-blur-sm transition"
            >
                <Download className="h-4 w-4" />
                Export Board
            </button>

            {isOpen && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-lg shadow-2xl border border-neutral-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 bg-neutral-50 border-b flex items-center justify-between">
                        <div className="flex items-center gap-x-2">
                            <Download className="h-4 w-4 text-neutral-600" />
                            <span className="font-bold text-sm text-neutral-700 font-sans">Interactive PDF Export</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} disabled={isGenerating} className="text-neutral-400 hover:text-neutral-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {isGenerating ? (
                            <div className="py-8 flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-bold text-neutral-800">{generationStatus}</p>
                                    {progress.total > 0 && (
                                        <div className="w-full mt-2">
                                            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-600 transition-all duration-300"
                                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-neutral-500 mt-1">{progress.current} / {progress.total}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
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

                                <div className="space-y-1.5 text-left bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Include Detail & Attachments For Selected Labels</label>
                                    <p className="text-[9px] text-neutral-400 italic mb-2 leading-tight">If no labels are selected, only Scene Summaries will be generated (no card contents or attachments).</p>
                                    
                                    {boardLabels.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {boardLabels.map(label => {
                                                const isSelected = selectedExportLabels.has(label.title);
                                                return (
                                                    <button
                                                        key={label.id}
                                                        onClick={() => toggleExportLabel(label.title)}
                                                        className={`flex items-center gap-x-1.5 px-2 py-1 rounded text-[10px] font-bold transition border ${isSelected ? 'shadow-sm' : 'opacity-60 bg-white border-neutral-200 text-neutral-600'}`}
                                                        style={isSelected ? { backgroundColor: label.color, color: '#fff', borderColor: label.color } : {}}
                                                    >
                                                        {isSelected ? <CheckSquare className="h-3 w-3 shrink-0" /> : <Square className="h-3 w-3 shrink-0 opacity-40" />}
                                                        <span className="truncate max-w-[100px]">{label.title}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-neutral-400 italic">No labels found on board.</div>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-left bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Attachment Options</label>
                                    <label className="flex items-center gap-x-2 text-xs font-medium text-neutral-700 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={includeImages} 
                                            onChange={(e) => setIncludeImages(e.target.checked)}
                                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5"
                                        />
                                        <ImageIcon className="h-3.5 w-3.5 text-neutral-400" /> Download & Embed Images
                                    </label>
                                    <label className="flex items-center gap-x-2 text-xs font-medium text-neutral-700 cursor-pointer mt-1">
                                        <input 
                                            type="checkbox" 
                                            checked={includePDFs} 
                                            onChange={(e) => setIncludePDFs(e.target.checked)}
                                            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-600 h-3.5 w-3.5"
                                        />
                                        <File className="h-3.5 w-3.5 text-neutral-400" /> Download & Merge PDFs
                                    </label>
                                    <p className="text-[9px] text-neutral-400 italic mt-1 pl-6">Google Maps links are always included as text links.</p>
                                </div>

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
                                        <div className="max-h-[200px] overflow-y-auto space-y-3 border border-neutral-200 rounded-lg p-2 bg-neutral-50/30">
                                            {displayGroups.map((group, gIdx) => {
                                                const groupLists = group.lists;
                                                const allGroupSelected = groupLists.length > 0 && groupLists.every(l => selectedListIds.has(l.id));
                                                
                                                return (
                                                    <div key={gIdx} className="space-y-1">
                                                        <div className="sticky top-0 bg-neutral-50/90 backdrop-blur px-1 py-0.5 z-10 border-b border-neutral-200 flex items-center gap-x-2">
                                                            {exportOrder === "day" && (
                                                                <button onClick={() => toggleDayGroup(groupLists)} className="shrink-0 flex items-center justify-center">
                                                                    <div className={`h-3 w-3 rounded-[3px] border flex items-center justify-center transition ${allGroupSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300 hover:border-indigo-400'}`}>
                                                                        {allGroupSelected && <CheckSquare className="h-2.5 w-2.5 text-white" />}
                                                                    </div>
                                                                </button>
                                                            )}
                                                            <span className="text-[10px] font-bold text-neutral-500 uppercase">{group.label}</span>
                                                        </div>
                                                        {groupLists.map(list => (
                                                            <div 
                                                                key={list.id}
                                                                onClick={() => toggleList(list.id)}
                                                                className={`flex items-center gap-x-3 px-2 py-1.5 rounded-md cursor-pointer transition ml-1 ${selectedListIds.has(list.id) ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-neutral-100 text-neutral-600'}`}
                                                            >
                                                                <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selectedListIds.has(list.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-neutral-300'}`}>
                                                                    {selectedListIds.has(list.id) && <div className="h-1 w-1 bg-white rounded-full" />}
                                                                </div>
                                                                <span className="text-xs font-semibold truncate flex-1 text-left">{list.title}</span>
                                                                <span className="text-[9px] opacity-60">({list.cards?.length || 0})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-y-2 pt-2 border-t border-neutral-200 mt-2">
                                    <button
                                        onClick={generatePDF}
                                        disabled={isGenerating || isLoadingData || selectedListIds.size === 0}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white rounded-md py-2.5 text-sm font-bold shadow-md shadow-indigo-100 transition flex items-center justify-center gap-x-2 cursor-pointer"
                                    >
                                        <FileText className="h-4 w-4" />
                                        Download {selectedListIds.size} Lists as PDF
                                    </button>

                                    <button
                                        onClick={generateZIP}
                                        disabled={isGenerating || isLoadingData || selectedListIds.size === 0}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-md py-2.5 text-sm font-bold shadow-md shadow-emerald-100 transition flex items-center justify-center gap-x-2 cursor-pointer"
                                    >
                                        <FolderArchive className="h-4 w-4" />
                                        Download {selectedListIds.size} Lists as ZIP
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
