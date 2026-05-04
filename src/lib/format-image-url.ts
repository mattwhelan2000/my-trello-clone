export const formatImageUrl = (url: string | undefined | null) => {
    if (!url) return url;

    // Convert Dropbox links to direct download formats and wrap in proxy for persistence
    if (url.includes("dropbox.com") || url.includes("dropboxusercontent.com")) {
        let directUrl = url;
        try {
            // Replace domain with dl.dropboxusercontent.com for better embedding
            let formattedUrl = url.replace(/www\.dropbox\.com/, "dl.dropboxusercontent.com");
            formattedUrl = formattedUrl.replace(/dropbox\.com/, "dl.dropboxusercontent.com");

            const urlObj = new URL(formattedUrl);
            
            // Handle dl=0 or missing raw/dl by setting raw=1 for direct stream
            if (urlObj.searchParams.get("dl") === "0") {
                urlObj.searchParams.set("raw", "1");
                urlObj.searchParams.delete("dl");
            } else if (!urlObj.searchParams.has("raw") && !urlObj.searchParams.has("dl")) {
                urlObj.searchParams.set("raw", "1");
            }
            
            directUrl = urlObj.toString();
        } catch (error) {
            // Fallback to simple replace if URL parsing fails
            let fallback = url.replace(/www\.dropbox\.com/, "dl.dropboxusercontent.com");
            fallback = fallback.replace(/dropbox\.com/, "dl.dropboxusercontent.com");

            if (fallback.includes("dl=0")) {
                fallback = fallback.replace("dl=0", "raw=1");
            } else if (!fallback.includes("raw=1") && !fallback.includes("dl=1")) {
                fallback = fallback + (fallback.includes("?") ? "&raw=1" : "?raw=1");
            }
            directUrl = fallback;
        }

        // WRAP IN PROXY: This is the key fix for "later disappearing" images.
        // It ensures our server fetches the image and serves it with long-term cache headers.
        return `/api/proxy-image?url=${encodeURIComponent(directUrl)}`;
    }

    // Wrap ngrok links in proxy to bypass browser warnings
    if (url.includes("ngrok-free.dev") && url.includes("view?filename=")) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }

    return url;
};
