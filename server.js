const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- READ FROM ENV OR USE DEFAULT SANDBOX KEYS ---
const CONSUMER_KEY = (process.env.CONSUMER_KEY || 'XhDTkFome5qGLII2zgQAII3I6LGA2yC97K9XrFuessHRaxjI').trim();
const CONSUMER_SECRET = (process.env.CONSUMER_SECRET || 'pUyle1cKxhniglbCYtxusfg92IPiALMw7xiGBinKHjkhyN5hc5sPoq4AyvjR1mAG').trim();
const SHORTCODE = (process.env.SHORTCODE || '174379').trim();
const PASSKEY = (process.env.PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919').trim();

// Helper: Format Timestamp (YYYYMMDDHHmmss)
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

// Middleware: OAuth Token Generation
async function getAccessToken(req, res, next) {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }
    );
    req.accessToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('OAuth Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'OAuth Handshake Failed', details: error.response ? error.response.data : error.message });
  }
}

// STK Push Endpoint
app.post('/api/stkpush', getAccessToken, async (req, res) => {
  try {
    let { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required.' });
    }

    // Format phone number to 254XXXXXXXXX
    phone = String(phone).trim().replace(/\+/g, '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1);
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const callbackUrl = `${protocol}://${host}/api/callback`;

    const timestamp = getTimestamp();
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const stkPayload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: String(amount),
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: 'H-Custom Store',
      TransactionDesc: 'Payment Transaction'
    };

    const stkResponse = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('STK Request Sent Successfully:', stkResponse.data);
    res.status(200).json({ success: true, data: stkResponse.data });
  } catch (error) {
    console.error('STK Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ 
      error: 'STK Push Request Failed', 
      details: error.response ? error.response.data : error.message 
    });
  }
});

// M-Pesa Callback Webhook
app.post('/api/callback', (req, res) => {
  console.log('--- Incoming M-Pesa Callback ---');
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
