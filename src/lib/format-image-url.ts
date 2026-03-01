export const formatImageUrl = (url: string | undefined | null) => {
    if (!url) return url;

    // Convert Dropbox links to direct download formats
    if (url.includes("dropbox.com")) {
        try {
            const urlObj = new URL(url);
            if (urlObj.searchParams.get("dl") === "0") {
                urlObj.searchParams.set("raw", "1");
                urlObj.searchParams.delete("dl");
                return urlObj.toString();
            } else if (!urlObj.searchParams.has("raw") && !urlObj.searchParams.has("dl")) {
                urlObj.searchParams.set("raw", "1");
                return urlObj.toString();
            }
        } catch (error) {
            // Fallback to simple replace if URL parsing fails
            if (url.includes("dl=0")) {
                return url.replace("dl=0", "raw=1");
            }
        }
    }

    return url;
};
