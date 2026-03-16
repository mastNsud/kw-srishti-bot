const fetch = require('node-fetch');

// ── CONFIG ──
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
const SALES_WA = process.env.SALES_WHATSAPP_NUMBER || '919003068325';

// ── AGENDA ──
// What we need to collect from the lead
const AGENDA = [
  { key: 'name', label: 'Good Name', description: 'User full name' },
  { key: 'apartment_type', label: 'Apartment Type', description: '1/2/3 BHK or Penthouse' },
  { key: 'purpose', label: 'Purpose', description: 'Self-occupation or Investment' },
  { key: 'budget', label: 'Budget', description: 'Approximate budget range' },
  { key: 'timeline', label: 'Timeline', description: 'Buying timeline (e.g., 1 month, 3 months)' },
  { key: 'phone', label: 'Mobile Number', description: '10-digit contact number' },
  { key: 'email', label: 'Email Address', description: 'Optional email for brochure' }
];

// ── AI ENGINE via OpenRouter ──
async function askAI(session, userInput) {
  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set');
    return null;
  }

  const collected = session.leadData || {};
  const missing = AGENDA.filter(a => !collected[a.key] || collected[a.key] === 'pending');
  const nextTarget = missing[0];

  const systemPrompt = `You are Priya, a friendly, professional, and helpful sales advisor for KW Srishti (NH-58, Raj Nagar Extension, Ghaziabad).
KW Srishti is a luxury residential project with GDA approval, freehold land, 80% green area, and 40+ amenities like a guitar-shaped pool.

GOAL: Converse naturally with the user while subtly guiding them to provide lead qualification details.
AGENDA (Collect these in order if possible): 
${AGENDA.map(a => `- ${a.label} (${a.key})`).join('\n')}

CURRENT DATA COLLECTED:
${JSON.stringify(collected, null, 2)}

NEXT TARGET: ${nextTarget ? nextTarget.label : 'None (All collected)'}

INSTRUCTIONS:
1. Be warm, human, and conversational. Don't sound like a form.
2. Acknowledge what the user just said.
3. If they ask a property question, answer it concisely using your knowledge.
4. Always steer back to the AGENDA if something is missing.
5. ENGAGEMENT HOOKS:
   - If the user asks for a BROCHURE, prioritize getting their **Email Address**.
   - If the user asks for a SITE VISIT, prioritize getting their **Mobile Number** and preferred time.
   - If the user asks to check availability, emphasize urgency (limited units left).
6. PROVIDE SUGGESTED BUTTONS (Quick Replies) at the end of your message in this format: [BUTTON: Label]. Max 4 buttons.
7. Keep responses concise (under 100 words).

KNOWLEDGE BASE:
- Location: NH-58, Raj Nagar Extension, Ghaziabad. Direct access from NH-58.
- Units: 1BHK (740-875 sq.ft), 2BHK (985-1310 sq.ft), 3BHK (1485-1500 sq.ft), Penthouse (1900-2650 sq.ft).
- Amenities: Guitar shaped pool, 40+ facilities, 24hr power/water, shopping complex inside.
- Legal: GDA Approved, Freehold land.
- Loans: SBI, HDFC, ICICI, etc approved.

USER INPUT: "${userInput}"`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/mastNsud/kw-srishti-bot',
        'X-Title': 'KW Srishti Bot'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...((session.history || []).slice(-6).map(h => ({ role: h.role === 'bot' ? 'assistant' : 'user', content: h.text }))),
          { role: 'user', content: userInput }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ OpenRouter API Error:', response.status, data);
      return null;
    }

    let text = data.choices?.[0]?.message?.content || "I'm sorry, I'm having a little trouble connecting. Could you try that again?";

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
    console.error('OpenRouter Error:', err);
    return null;
  }
}

// ── DATA EXTRACTION (Pseudo-NLP) ──
function extractLeadData(text, collected) {
  const lower = text.toLowerCase();
  
  // Very basic extraction for now (AI handles the flow, this helps track state)
  // In a more advanced version, we'd use the AI to return JSON of extracted fields.
  
  if (!collected.name && text.length > 2 && text.length < 50 && !lower.includes('hello') && !lower.includes('hi')) {
    collected.name = text;
  }
  
  if (lower.includes('bhk') || lower.includes('penthouse')) {
    collected.apartment_type = text;
  }
  
  if (lower.includes('self') || lower.includes('invest') || lower.includes('rent')) {
    collected.purpose = text;
  }
  
  if (lower.includes('lakh') || lower.includes('crore') || lower.includes('budget')) {
    collected.budget = text;
  }
  
  if (lower.includes('month') || lower.includes('soon') || lower.includes('exploring')) {
    collected.timeline = text;
  }
  
  const phoneMatch = text.match(/\d{10}/);
  if (phoneMatch) {
    collected.phone = phoneMatch[0];
  }
  
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    collected.email = emailMatch[0];
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

  const aiResult = await askAI(session, userInput || "Start the conversation");
  if (!aiResult) {
    return { message: "I'm having a brief technical moment. Please say hi to restart!", type: 'error' };
  }

  session.history.push({ role: 'bot', text: aiResult.text, ts: Date.now() });

  const isComplete = !!(session.leadData.phone && session.leadData.name);
  
  // If complete, generate WhatsApp link
  let waLink = null;
  if (isComplete) {
    const waText = encodeURIComponent(`Hi, I'm ${session.leadData.name}. I'm interested in KW Srishti (${session.leadData.apartment_type || 'Homes'}). My budget is ${session.leadData.budget || 'flexible'}. Please call me at ${session.leadData.phone}.`);
    waLink = `https://wa.me/${SALES_WA}?text=${waText}`;
  }

  const response = {
    message: aiResult.text,
    quick_replies: aiResult.buttons.length > 0 ? aiResult.buttons : null,
    is_complete: isComplete,
    wa_link: waLink,
    social_links: {
      facebook: process.env.FB_LINK,
      instagram: process.env.IG_LINK,
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
  if (d.phone) s += 25;
  if (d.email) s += 15;
  if (d.timeline && (d.timeline.includes('1') || d.timeline.includes('soon'))) s += 20;
  if (d.budget && (d.budget.includes('90') || d.budget.includes('crore'))) s += 10;
  return Math.min(s, 100);
}

module.exports = { buildBotResponse, calcScore };
