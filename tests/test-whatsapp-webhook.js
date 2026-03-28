require('dotenv').config();
const fetch = require('node-fetch');

async function testWebhook() {
  console.log('🧪 Testing WhatsApp Webhook (Twilio Simulation)...');

  const endpoint = 'http://localhost:3005/api/whatsapp/webhook';
  
  const payload = new URLSearchParams();
  payload.append('From', 'whatsapp:+919988776655');
  payload.append('Body', 'Hi, I am interested in a 3BHK at KW Srishti.');
  payload.append('ProfileName', 'Sudhir');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Header:', response.headers.get('content-type'));
    console.log('Response TwiML:\n', text);

    if (text.includes('<Response>') && text.includes('<Message>')) {
      console.log('✅ Webhook Response Valid!');
    } else {
      console.log('❌ Webhook Response Invalid.');
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testWebhook();
