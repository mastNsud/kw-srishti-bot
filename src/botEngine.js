const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ── CONFIG ──
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const PRIMARY_MODEL = process.env.HF_PRIMARY_MODEL || 'meta-llama/Llama-3.2-1B-Instruct';
const SALES_WA = process.env.SALES_WHATSAPP_NUMBER || '919003068325';

// Load Grounded Knowledge
const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge.txt');
let PROJECT_KNOWLEDGE = "KW Srishti is a luxury residential project by KW Group in Raj Nagar Extension, Ghaziabad.";
try {
  if (fs.existsSync(KNOWLEDGE_PATH)) {
    PROJECT_KNOWLEDGE = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
  }
} catch (err) {
  console.error('Error loading knowledge.txt:', err);
}

// ── AGENDA (Real Estate Industry) ──
const AGENDA = [
  { key: 'name', label: 'Good Name', description: 'User name' },
  { key: 'apartment_type', label: 'Apartment Type', description: '1/2/3 BHK or Penthouse' },
  { key: 'purpose', label: 'Purpose', description: 'Self-occupation or Investment' },
  { key: 'budget', label: 'Budget', description: 'Approximate budget range' },
  { key: 'timeline', label: 'Timeline', description: 'Buying timeline' },
  { key: 'location', label: 'Current Location', description: 'Where do they stay currently?' },
  { key: 'language', label: 'Preferred Language', description: 'English/Hindi/etc.' },
  { key: 'phone', label: 'Mobile Number', description: '10-digit contact' }
];

// ── AI ENGINE via Hugging Face Router ──
async function askAI(session, userInput) {
  if (!HF_TOKEN) {
    console.error('❌ HUGGINGFACE_TOKEN not set');
    return null;
  }

  const collected = session.leadData || {};
  const missing = AGENDA.filter(a => !collected[a.key] || collected[a.key] === 'pending');
  const nextTarget = missing[0];

  const systemPrompt = `You are Priya, a friendly, professional, and helpful sales advisor for KW Srishti (by KW Group).
KW Srishti is a luxury residential project in NH-58, Raj Nagar Extension, Ghaziabad.

GOAL: Converse naturally with the user while subtly guiding them to provide real estate lead qualification details.
AGENDA (Collect these gracefully): 
${AGENDA.map(a => `- ${a.label} (${a.key})`).join('\n')}

CURRENT DATA COLLECTED:
${JSON.stringify(collected, null, 2)}

NEXT TARGET: ${nextTarget ? nextTarget.label : 'None (All collected)'}

INSTRUCTIONS:
1. Be warm, human, and conversational. Don't sound like a robot asking for data.
2. USE ONLY THE PROJECT KNOWLEDGE BELOW for technical specs, pricing, and project details. 
3. If information is missing, prioritize the NEXT TARGET but acknowledge user queries first.
4. **PERSONALIZATION**:
   - If you know their **Current Location**, highlight how convenient KW Srishti is for them (commute-wise).
   - If they speak Hindi, respond in Hindi (or a mix).
   - Try to infer **Demographics** (e.g., family size) to recommend 2BHK vs 3BHK.
5. If they give a phone number, tell them: "Our consultant will call you shortly with the best deals! ✨"
6. PROVIDE SUGGESTED BUTTONS in this format: [BUTTON: Label]. Max 4 buttons.
7. Keep responses concise (under 100 words).

PROJECT KNOWLEDGE:
${PROJECT_KNOWLEDGE}

USER INPUT: "${userInput}"`;

  // Fallback Chain (Optimized for speed < 8s)
  const models = [
    PRIMARY_MODEL,
    'Qwen/Qwen2.5-1.5B-Instruct',
    'microsoft/Phi-3.5-mini-instruct',
    'HuggingFaceH4/zephyr-7b-beta'
  ];

  for (const modelId of models) {
    try {
      console.log(`🤖 Priya attempting AI response with HF model: ${modelId}`);
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            ...((session.history || []).slice(-6).map(h => ({ role: h.role === 'bot' ? 'assistant' : 'user', content: h.text }))),
            { role: 'user', content: userInput }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.warn(`⚠️ HF Model ${modelId} failed (${response.status}):`, data.error || 'Unknown error');
        continue;
      }

      let text = data.choices?.[0]?.message?.content || "";
      if (!text) continue;

      // Extract buttons [BUTTON: Label]
      const buttons = [];
      const btnRegex = /\[BUTTON:\s*(.*?)\]/g;
      let match;
      while ((match = btnRegex.exec(text)) !== null) {
        buttons.push(match[1].trim());
      }
      text = text.replace(btnRegex, '').trim();

      return { text, buttons };
    } catch (err) {
      console.error(`❌ HF Connection error for ${modelId}:`, err.message);
      continue;
    }
  }

  console.error('❌ All HF models failed.');
  return null;
}

// ── DATA EXTRACTION (Pseudo-NLP) ──
function extractLeadData(text, collected) {
  const lower = text.toLowerCase();
  
  // Language Detection (Simple)
  if (/[अ-ज्ञ]/.test(text)) collected.language = 'Hindi';
  else if (!collected.language) collected.language = 'English';

  // Phone: match 10 digits
  const phoneMatch = text.match(/\d{10}/);
  if (phoneMatch) collected.phone = phoneMatch[0];

  // BHK requirement
  if (lower.includes('bhk') || lower.includes('1') || lower.includes('2') || lower.includes('3') || lower.includes('penthouse')) {
    collected.apartment_type = text;
  }

  // Location detection (hints)
  const locations = ['delhi', 'noida', 'gurgaon', 'ghaziabad', 'meerut', 'hapur', 'mumbai'];
  locations.forEach(loc => {
    if (lower.includes(loc)) collected.location = loc.charAt(0).toUpperCase() + loc.slice(1);
  });

  // Purpose
  if (lower.includes('self') || lower.includes('invest') || lower.includes('rent')) {
    collected.purpose = text;
  }

  // Budget
  if (lower.includes('lakh') || lower.includes('crore') || lower.includes('budget') || lower.includes('cr')) {
    collected.budget = text;
  }

  // Timeline
  if (lower.includes('month') || lower.includes('year') || lower.includes('immediate')) {
    collected.timeline = text;
  }

  // Name extraction (simple fallback)
  if (!collected.name && text.length > 2 && text.length < 30 && !lower.includes('hello') && !lower.includes('hi') && !phoneMatch) {
    collected.name = text;
  }
}

// ── MAIN RESPONSE BUILDER ──
async function buildBotResponse(session, userInput, req) {
  session.leadData = session.leadData || {};
  session.history = session.history || [];

  if (userInput) {
    session.history.push({ role: 'user', text: userInput, ts: Date.now() });
    extractLeadData(userInput, session.leadData);
  }

  const aiResult = await askAI(session, userInput || "How can I help you today?");
  if (!aiResult) {
    return { message: "I'm having a brief technical moment. Please say hi to restart! ✨", type: 'error' };
  }

  session.history.push({ role: 'bot', text: aiResult.text, ts: Date.now() });

  const isComplete = !!(session.leadData.phone && session.leadData.name);
  
  // If complete, generate WhatsApp link
  let waLink = null;
  if (isComplete) {
    const waText = encodeURIComponent(`Hi Priya! I'm ${session.leadData.name}. I'm interested in KW Srishti (${session.leadData.apartment_type || 'Homes'}). My phone is ${session.leadData.phone}.`);
    waLink = `https://wa.me/${SALES_WA}?text=${waText}`;
  }

  const response = {
    message: aiResult.text,
    quick_replies: aiResult.buttons.length > 0 ? aiResult.buttons : null,
    is_complete: isComplete,
    wa_link: waLink,
    social_links: {
      facebook: process.env.FB_LINK,
      instagram: process.env.IG_LINK || "https://www.instagram.com/kworld_group/",
      linkedin: process.env.LI_LINK,
      twitter: process.env.TW_LINK,
      youtube: process.env.YT_LINK
    }
  };

  return response;
}

function calcScore(d) {
  let s = 0;
  if (d.name) s += 10;
  if (d.phone) s += 30; // Phone is critical
  if (d.apartment_type) s += 15;
  if (d.budget) s += 15;
  if (d.timeline) s += 10;
  if (d.purpose) s += 5;
  
  // Profiling weights
  if (d.location) s += 5;
  if (d.language) s += 5;
  if (d.demographics) s += 5;

  return Math.min(s, 100);
}

module.exports = { buildBotResponse, calcScore };
