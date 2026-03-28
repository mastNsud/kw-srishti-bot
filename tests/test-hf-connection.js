require('dotenv').config();
const fetch = require('node-fetch');

async function testHF() {
  const token = process.env.HUGGINGFACE_TOKEN;
  const model = "meta-llama/Llama-3.2-1B-Instruct";
  
  if (!token) {
    console.error("❌ HUGGINGFACE_TOKEN is missing in .env");
    process.exit(1);
  }

  console.log(`📡 Testing connection to Hugging Face Router with model: ${model}...`);

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello APRA" if you can hear me.' }
        ],
        max_tokens: 20
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log("✅ Success! AI Responded:", data.choices[0].message.content);
    } else {
      console.error("❌ HF Error:", data.error || data);
    }
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
}

testHF();
