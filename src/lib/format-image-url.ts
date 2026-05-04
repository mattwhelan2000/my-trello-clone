export const formatImageUrl = (url: string | undefined | null) => {
    if (!url) return url;

    // Convert Dropbox links to direct download formats
    if (url.includes("dropbox.com") || url.includes("dropboxusercontent.com")) {
        try {
            // Replace domain with dl.dropboxusercontent.com for better embedding and to bypass preview pages
            let formattedUrl = url.replace(/www\.dropbox\.com/, "dl.dropboxusercontent.com");
            formattedUrl = formattedUrl.replace(/dropbox\.com/, "dl.dropboxusercontent.com");

            const urlObj = new URL(formattedUrl);
            
            // Handle dl=0 or missing raw/dl by setting raw=1 for direct stream (ideal for images)
            if (urlObj.searchParams.get("dl") === "0") {
                urlObj.searchParams.set("raw", "1");
                urlObj.searchParams.delete("dl");
            } else if (!urlObj.searchParams.has("raw") && !urlObj.searchParams.has("dl")) {
                urlObj.searchParams.set("raw", "1");
            }
            
            return urlObj.toString();
        } catch (error) {
            // Fallback to simple replace if URL parsing fails
            let fallback = url.replace(/www\.dropbox\.com/, "dl.dropboxusercontent.com");
            fallback = fallback.replace(/dropbox\.com/, "dl.dropboxusercontent.com");

            if (fallback.includes("dl=0")) {
                return fallback.replace("dl=0", "raw=1");
            }
            if (!fallback.includes("raw=1") && !fallback.includes("dl=1")) {
                return fallback + (fallback.includes("?") ? "&raw=1" : "?raw=1");
            }
            return fallback;
        }
    }

    return url;
};
