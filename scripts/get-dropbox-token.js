const { spawn } = require('child_process');
const http = require('http');
const url = require('url');
const axios = require('axios');

const APP_KEY = '2ns3shvcw5pvdi5';
const APP_SECRET = 'a62sq1xq4p2wnq4';
const PORT = 3005;
const REDIRECT_URI = `http://localhost:${PORT}`;

const SCOPES = 'files.metadata.read files.content.read';
const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${REDIRECT_URI}&scope=${encodeURIComponent(SCOPES)}`;

console.log('\n1. Please open this URL in your browser to authorize the app:');
console.log('\x1b[36m%s\x1b[0m', authUrl);
console.log('\n2. Waiting for you to authorize...');

const server = http.createServer(async (req, res) => {
    const query = url.parse(req.url, true).query;
    if (query.code) {
        res.end('Authorization successful! You can close this tab and return to the terminal.');
        
        console.log('3. Exchanging code for Refresh Token...');
        
        try {
            const params = new URLSearchParams();
            params.append('code', query.code);
            params.append('grant_type', 'authorization_code');
            params.append('redirect_uri', REDIRECT_URI);
            
            const authHeader = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');
            
            const response = await axios.post('https://api.dropbox.com/oauth2/token', params, {
                headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            console.log('\n\x1b[32mSUCCESS!\x1b[0m Your permanent Refresh Token is:');
            console.log('\x1b[1m%s\x1b[0m', response.data.refresh_token);
            console.log('\nCopy this value and update your DROPBOX_REFRESH_TOKEN secret in Google Cloud.');
            
            process.exit(0);
        } catch (error) {
            console.error('Error exchanging code:', error.response?.data || error.message);
            process.exit(1);
        }
    }
}).listen(PORT);
