const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/app/page.tsx');

if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const timestamp = `${month}${day}.${hours}:${minutes}`;

    // Regex to match the exact span with the timestamp format
    const regex = /(<span[^>]*>)\d{4}\.\d{2}:\d{2}(<\/span>)/;
    
    if (regex.test(content)) {
        content = content.replace(regex, `$1${timestamp}$2`);
        fs.writeFileSync(filePath, content);
        console.log(`Successfully updated dashboard timestamp to ${timestamp}`);
    }
}
