/**
 * Detects the file type from a URL based on extension and common patterns.
 * Returns a category string used for rendering the appropriate preview.
 */
export type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'office-word' | 'office-excel' | 'office-powerpoint' | 'svg' | 'code' | 'text' | 'link';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'ico', 'avif'];
const PDF_EXTENSIONS = ['pdf'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
const SVG_EXTENSIONS = ['svg'];
const WORD_EXTENSIONS = ['doc', 'docx', 'odt', 'rtf'];
const EXCEL_EXTENSIONS = ['xls', 'xlsx', 'csv', 'ods'];
const POWERPOINT_EXTENSIONS = ['ppt', 'pptx', 'odp'];
const CODE_EXTENSIONS = ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'md', 'sh', 'bat', 'sql'];
const TEXT_EXTENSIONS = ['txt', 'log', 'ini', 'cfg', 'conf'];

function getExtension(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastDot = pathname.lastIndexOf('.');
        if (lastDot === -1) return '';
        return pathname.substring(lastDot + 1).toLowerCase().split('?')[0];
    } catch {
        // Fallback for non-URL strings
        const lastDot = url.lastIndexOf('.');
        if (lastDot === -1) return '';
        return url.substring(lastDot + 1).toLowerCase().split('?')[0];
    }
}

export function detectFileType(url: string): FileCategory {
    const ext = getExtension(url);
    if (!ext) return 'link';

    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (SVG_EXTENSIONS.includes(ext)) return 'svg';
    if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (WORD_EXTENSIONS.includes(ext)) return 'office-word';
    if (EXCEL_EXTENSIONS.includes(ext)) return 'office-excel';
    if (POWERPOINT_EXTENSIONS.includes(ext)) return 'office-powerpoint';
    if (CODE_EXTENSIONS.includes(ext)) return 'code';
    if (TEXT_EXTENSIONS.includes(ext)) return 'text';

    return 'link';
}

export function getFileTypeLabel(category: FileCategory): string {
    switch (category) {
        case 'image': return 'Image';
        case 'svg': return 'SVG Image';
        case 'pdf': return 'PDF Document';
        case 'video': return 'Video';
        case 'audio': return 'Audio';
        case 'office-word': return 'Word Document';
        case 'office-excel': return 'Spreadsheet';
        case 'office-powerpoint': return 'Presentation';
        case 'code': return 'Code File';
        case 'text': return 'Text File';
        case 'link': return 'Website URL';
    }
}
