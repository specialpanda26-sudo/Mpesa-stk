const https = require('https');

// Key and Secret
const consumerKey = 'XhDTkFome5qGLII2zgQAII3I6LGA2yC97K9XrFuessHRaxjI'.trim();
const consumerSecret = 'pUyle1cKxhniglbCYtxusfg92IPiALMw7xiGBinKHjkhyN5hc5sPoq4AyvjR1mAG'.trim();
const shortCode = '174379';
const passkey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const phoneNumber = '254720170794';
const callbackUrl = 'https://app.hooklistener.com/w/my-first-endpoint-6210';
const amount = '1';

function getTimestamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const options = {
      hostname: 'sandbox.safaricom.co.ke',
      path: '/oauth/v1/generate?grant_type=client_credentials',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.access_token);
          } catch (e) {
            reject(`Failed to parse response JSON: ${data}`);
          }
        } else {
          reject(`HTTP ${res.statusCode} Response: ${data}`);
        }
      });
    });

    req.on('error', (e) => reject(`Network Error: ${e.message}`));
    req.end();
  });
}

function sendStkPush(accessToken) {
  return new Promise((resolve, reject) => {
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const postData = JSON.stringify({
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: 'TermuxTest',
      TransactionDesc: 'Test Payment'
    });

    const options = {
      hostname: 'sandbox.safaricom.co.ke',
      path: '/mpesa/stkpush/v1/processrequest',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => reject(`STK Error: ${e.message}`));
    req.write(postData);
    req.end();
  });
}

async function run() {
  try {
    console.log('🔄 Requesting Access Token...');
    const token = await getAccessToken();
    console.log('✅ Access Token Obtained!');

    console.log('🚀 Triggering STK Push...');
    const result = await sendStkPush(token);
    
    console.log('\n====================================');
    console.log('Response:', result);
    console.log('====================================');
  } catch (err) {
    console.error('\n❌ Execution Failed:\n', err);
  }
}

run();

