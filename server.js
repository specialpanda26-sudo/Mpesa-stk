const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- PayHero credentials: ALWAYS from environment variables, never hardcoded ---
// Set these in Render > your service > Environment:
//   PAYHERO_BASIC_AUTH   -> the full "Basic xxxxx..." token from PayHero API Keys page
//   PAYHERO_CHANNEL_ID   -> your Till's channel_id (e.g. 11375)
const PAYHERO_BASIC_AUTH = process.env.PAYHERO_BASIC_AUTH;
const PAYHERO_CHANNEL_ID = process.env.PAYHERO_CHANNEL_ID;

if (!PAYHERO_BASIC_AUTH || !PAYHERO_CHANNEL_ID) {
  console.warn('⚠️  PAYHERO_BASIC_AUTH / PAYHERO_CHANNEL_ID not set. Set them in your environment before going live.');
}

app.post('/api/stkpush', async (req, res) => {
  try {
    if (!PAYHERO_BASIC_AUTH || !PAYHERO_CHANNEL_ID) {
      return res.status(500).json({ error: 'Server is missing PayHero credentials. Set PAYHERO_BASIC_AUTH and PAYHERO_CHANNEL_ID as environment variables.' });
    }

    let { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone number and amount are required.' });
    }

    // Normalize phone to 2547XXXXXXXX format
    phone = String(phone).trim().replace(/\+/g, '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1);
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const callbackUrl = `${protocol}://${host}/api/callback`;

    const stkPayload = {
      amount: Number(amount),
      phone_number: phone,
      channel_id: Number(PAYHERO_CHANNEL_ID),
      provider: 'm-pesa',
      external_reference: `HCS-${Date.now()}`,
      callback_url: callbackUrl
    };

    const stkResponse = await axios.post(
      'https://backend.payhero.co.ke/api/v2/payments',
      stkPayload,
      {
        headers: {
          Authorization: PAYHERO_BASIC_AUTH, // already the full "Basic xxxx" string
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({ success: true, data: stkResponse.data });
  } catch (error) {
    console.error('STK Exception:', error.response ? error.response.data : error.message);
    res.status(500).json({
      error: 'STK Push Request Failed',
      details: error.response ? error.response.data : error.message
    });
  }
});

app.post('/api/callback', (req, res) => {
  console.log('--- M-Pesa Callback Payload ---', req.body);
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
