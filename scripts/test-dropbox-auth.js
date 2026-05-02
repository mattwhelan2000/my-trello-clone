const axios = require('axios');

const APP_KEY = '2ns3shvcw5pvdi5';
const APP_SECRET = 'a62sq1xq4p2wnq4';
const REFRESH_TOKEN = 'xxBEdEjj2TUAAAAAAAAAARLif4XlZ820ynVIg27At8lO8MtOefl1LBE1pNeifAOo';

async function testRefresh() {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', REFRESH_TOKEN);
    
    const authHeader = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');
    
    try {
        const response = await axios.post('https://api.dropbox.com/oauth2/token', params, {
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const accessToken = response.data.access_token;
        console.log('SUCCESS! Obtained Access Token.');
        
        // Test a real metadata call
        console.log('Testing metadata access...');
        const listResponse = await axios.post('https://api.dropbox.com/2/files/list_folder', 
            { path: '', recursive: false },
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );
        console.log('VERIFIED! Metadata access works.');
    } catch (error) {
        console.error('FAILED!', error.response?.data || error.message);
    }
}

testRefresh();
