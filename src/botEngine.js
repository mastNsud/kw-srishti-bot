const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { getOptimizedUrl, mapLocalToPublicId } = require('./utils/cloudinaryService');
const { searchKnowledge } = require('./vectorService');

// ── CONFIG ──
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const PRIMARY_MODEL = process.env.HF_PRIMARY_MODEL || 'meta-llama/Llama-3.2-1B-Instruct';
const SALES_WA = process.env.SALES_WHATSAPP_NUMBER || '14155238886';
const BROCHURE_URL = process.env.BROCHURE_URL || 'https://www.kwgroup.in/kw-srishti/brochure.pdf';
const SITE_VISIT_TEL = process.env.SITE_VISIT_TEL || '+919310908888';

// Load Grounded Knowledge (Legacy fallback)
const KNOWLEDGE_PATH = path.join(__dirname, '../knowledge.txt');
let KNOWLEDGE_SEGMENTS = { default: "KW Srishti is a luxury residential project by KW Group in Raj Nagar Extension, Ghaziabad." };

function updateKnowledge() {
  try {
    if (fs.existsSync(KNOWLEDGE_PATH)) {
      const fullText = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
      // Segment by Section Header (e.g., "PRICING", "LOCATION")
      const sections = fullText.split(/\n\n/);
      sections.forEach(sec => {
        const lines = sec.split('\n');
        const header = lines[0].replace(':', '').trim().toUpperCase();
        if (header.length > 3) KNOWLEDGE_SEGMENTS[header] = sec;
      });
      KNOWLEDGE_SEGMENTS.all = fullText;
    }
  } catch (err) {
    console.error('Error loading knowledge.txt:', err);
  }
}
updateKnowledge();

// ── PROPERTY ASSETS (Images & Cards) ──
const PROPERTY_ASSETS = {
  '1BHK': {
    image: 'images/tower A 1 bhk.jpg',
    title: 'Tower A - 1 BHK Studio',
    area: '740 sq.ft.',
    tower: 'Tower A',
    status: 'Ready to Move'
  },
  '1BHK STUDY': {
    image: 'images/tower A 1bhk+Study.jpg',
    title: 'Tower A - 1 BHK + Study',
    area: '875 sq.ft.',
    tower: 'Tower A',
    status: 'Ready to Move'
  },
  '2BHK': {
    image: 'images/tower B 2 bhk.jpg',
    title: 'Tower B - 2 BHK Comfort',
    area: '985 sq.ft.',
    tower: 'Tower B',
    status: 'Ready to Move'
  },
  '2BHK STUDY': {
    image: 'images/tower I 2bhk + Study.jpg',
    title: 'Tower I - 2 BHK + Study',
    area: '1220 sq.ft.',
    tower: 'Tower I',
    status: 'New Project'
  },
  '3BHK': {
    image: 'images/tower H 3 bhk.jpg',
    title: 'Tower H - 3 BHK Elite',
    area: '1485 sq.ft.',
    tower: 'Tower H',
    status: 'Ready to Move'
  },
  'PENTHOUSE': {
    image: 'images/tower D 3 bhk penthouse.jpg',
    title: 'Tower D - Luxury Penthouse',
    area: '1900 sq.ft.',
    tower: 'Tower D',
    status: 'Limited Availability'
  }
};

// ── AGENDA (Core Lead Qualification) ──
const AGENDA = [
  { key: 'name', label: 'Name', description: 'User name' },
  { key: 'phone', label: 'Phone Number', description: '10-digit mobile number' },
  { key: 'apartment_type', label: 'Unit', description: '1/2/3 BHK or Penthouse' },
  { key: 'budget', label: 'Budget', description: 'Approximate budget range' },
  { key: 'timeline', label: 'Timeline', description: 'Buying timeline' }
];

// ── AI ENGINE via Hugging Face Router ──
async function askAI(session, userInput, context = "") {
  if (!HF_TOKEN) {
    console.error('❌ HUGGINGFACE_TOKEN not set');
    return null;
  }

  const collected = session.leadData || {};
  const missing = AGENDA.filter(a => !collected[a.key] || collected[a.key] === 'pending');
  const nextTarget = missing[0];

  // Simple RAG retrieval: find top 2 sections most relevant to user input
  const lowerInput = userInput.toLowerCase();
  const relevantSections = Object.keys(KNOWLEDGE_SEGMENTS)
    .filter(k => k !== 'all' && k !== 'default')
    .filter(k => lowerInput.includes(k.toLowerCase()) || KNOWLEDGE_SEGMENTS[k].toLowerCase().includes(lowerInput))
    .map(k => KNOWLEDGE_SEGMENTS[k]);
  
  const contextData = relevantSections.length > 0 ? relevantSections.join('\n\n') : KNOWLEDGE_SEGMENTS.all;

  const systemPrompt = `You are Priya, a friendly, professional, and helpful Senior Sales Advisor for KW Srishti (by KW Group).
KW Srishti is a luxury residential project in NH-58, Raj Nagar Extension, Ghaziabad.

GOAL: Converse naturally with the user while subtly guiding them to provide real estate lead qualification details.

CURRENT DATA (DO NOT MIRROR OR ECHO THIS):
${JSON.stringify(collected, null, 2)}

STRICT RULES:
1. NEVER summarize or list out the fields you know (e.g., do not say "Name: John").
2. Answer the user's question first using the PROJECT KNOWLEDGE below, then gracefully nudge for *just one* missing detail.
3. Keep your response under 3 sentences. Be warm and concise.
4. **CRITICAL TARGET**: You are currently trying to get their: ${nextTarget ? nextTarget.label : 'visit'}. You MUST end your message by asking a natural question to get this information. 
   - Examples: "May I have your phone number to share the brochure on WhatsApp?", "What is your good name?"
   - Do not ask for multiple things at once. Do not ask for formal quotes.
5. If the user asks for prices not in the knowledge, say "Our sales team can provide a precise quote for that specific unit."
6. Provide action buttons where appropriate using [BUTTON: Label]. Examples: [BUTTON: Download Brochure], [BUTTON: Book Site Visit].

PROJECT KNOWLEDGE:
${contextData || KNOWLEDGE_SEGMENTS.default}

USER INPUT: "${userInput}"`;

  const models = [
    PRIMARY_MODEL,
    'Qwen/Qwen2.5-1.5B-Instruct',
    'microsoft/Phi-3.5-mini-instruct'
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
            ...((session.history || []).slice(-8).map(h => ({ role: h.role === 'bot' ? 'assistant' : 'user', content: h.text })))
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

// ── AI ENTITY EXTRACTION (Multi-Provider) ──
async function extractEntitiesAI(text) {
  const token = process.env.HUGGINGFACE_TOKEN;
  const orKey = process.env.OPENROUTER_API_KEY;
  
  if (!token && !orKey) {
    console.warn('⚠️ No AI tokens found for extraction (HF or OpenRouter)');
    return null;
  }

const extractionPrompt = `Extract real estate lead details from this message into a JSON object. 
Fields: name, phone, apartment_type, budget, purpose, timeline, location, demographics.

CRITICAL RULES:
1. If a field is NOT explicitly mentioned in the USER MESSAGE, you MUST return null for that field. DO NOT guess or hallucinate.
2. For budget: Keep original units (e.g., if user says "90 Lakhs" output "90 Lakhs"). Do not normalize to numbers.
3. For purpose: Only output "Investment" or "Self" if explicitly stated. Otherwise, null.

Only return the JSON. No preamble.

USER MESSAGE: "${text}"`;

  // Try HF First
  if (token) {
    try {
      console.log('📡 Attempting HF Extraction...');
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: PRIMARY_MODEL,
          messages: [{ role: 'user', content: extractionPrompt }],
          max_tokens: 300,
          temperature: 0.1
        })
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        console.log('✅ HF Extraction raw content:', content);
        const jsonStr = content.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      } else {
        const errData = await response.json();
        console.warn('⚠️ HF Extraction HTTP error:', response.status, errData);
      }
    } catch (err) {
      console.warn('⚠️ HF Extraction failed:', err.message);
    }
  }

  // Try OpenRouter Fallback
  if (orKey) {
    try {
      console.log('📡 Attempting OpenRouter Extraction...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${orKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'qwen/qwen-2-72b-instruct:free',
          messages: [{ role: 'user', content: extractionPrompt }],
          max_tokens: 300
        })
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        console.log('✅ OR Extraction raw content:', content);
        const jsonStr = content.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
      } else {
        const errData = await response.json();
        console.warn('⚠️ OR Extraction HTTP error:', response.status, errData);
      }
    } catch (err) {
      console.error('❌ All AI Extraction providers failed:', err.message);
    }
  }

  return null;
}

// ── DATA EXTRACTION (Pseudo-NLP + AI) ──
async function extractLeadData(text, collected) {
  const lower = text.toLowerCase();
  
  // 1. Language Detection (Immediate)
  if (/[अ-ज्ञ]/.test(text)) collected.language = 'Hindi';
  else if (!collected.language) collected.language = 'English';

  // 2. AI Extraction (Async)
  const aiExtracted = await extractEntitiesAI(text);
  if (aiExtracted) {
    Object.keys(aiExtracted).forEach(key => {
      if (aiExtracted[key] && (!collected[key] || collected[key] === 'pending')) {
        collected[key] = aiExtracted[key];
      }
    });
  }

  // 3. Regex Fallback (Safety Net)
  // Smarter regex: finds 10 digits starting with 6-9, optionally preceded by +91 or 0
  const normalizedText = text.replace(/[\s-]/g, '');
  const phoneMatch = normalizedText.match(/(?:\+91|0)?([6-9]\d{9})(?!\d)/);
  if (phoneMatch && !collected.phone) {
    collected.phone = phoneMatch[1]; // Capture the 10-digit group specifically
    console.log(`📱 Regex extracted phone: ${collected.phone}`);
  }

  // Smarter Budget (Lakhs/Crores) - Regex is often more reliable than small LLMs for units
  const budgetMatch = text.match(/(\d+\.?\d*)\s*(lakh|lac|cr|crore|cr\.)/i);
  if (budgetMatch) {
    collected.budget = budgetMatch[0].toUpperCase().replace('LAC', 'LAKH');
  }

  // Smarter BHK
  const bhkMatch = text.match(/([1234])\s*(bhk|rk)/i);
  if (bhkMatch && (!collected.apartment_type || collected.apartment_type === 'pending')) {
    collected.apartment_type = bhkMatch[0].toUpperCase();
  } else if (lower.includes('penthouse') && (!collected.apartment_type || collected.apartment_type === 'pending')) {
    collected.apartment_type = 'PENTHOUSE';
  }

  // Location (Existing logic)
  if (!collected.location) {
    const locations = ['delhi', 'noida', 'gurgaon', 'ghaziabad', 'meerut', 'hapur', 'mumbai'];
    locations.forEach(loc => {
      if (lower.includes(loc)) collected.location = loc.charAt(0).toUpperCase() + loc.slice(1);
    });
  }

  // Name extraction (Refined fallback)
  if (!collected.name && text.split(' ').length < 4 && !lower.includes('hi') && !lower.includes('hello') && !phoneMatch && !budgetMatch) {
    const cleanName = text.replace(/[^a-zA-Z\s]/g, '').trim();
    if (cleanName.length > 2 && cleanName.length < 20) {
      collected.name = cleanName;
    }
  }
}

// ── MAIN RESPONSE BUILDER ──
async function buildBotResponse(session, userInput, req) {
  session.leadData = session.leadData || {};
  session.history = session.history || [];

  // 1. Semantic Context Retrieval
  let context = "";
  if (userInput) {
    context = await searchKnowledge(userInput);
    session.history.push({ role: 'user', text: userInput, ts: Date.now() });
    await extractLeadData(userInput, session.leadData);
    console.log('📝 Current Lead Data state:', JSON.stringify(session.leadData));
  }

  // 2. Intent Detection (Simple keyword based for media control)
  const lowerInput = (userInput || "").toLowerCase();
  const intents = {
    visuals: /photo|image|view|floor|plan|map|look|see|inside|exterior/i.test(lowerInput),
    brochure: /brochure|pdf|document|details/i.test(lowerInput),
    budget: /price|cost|budget|amount|worth/i.test(lowerInput),
    unit: /bhk|penthouse|flat|apartment|size/i.test(lowerInput)
  };

  let aiResult = await askAI(session, userInput || "How can I help you today?", context);
  if (!aiResult) {
    console.warn('⚠️ AI Response failed. Falling back to structured data summary.');
    const missing = AGENDA.filter(a => !session.leadData[a.key] || session.leadData[a.key] === 'pending');
    const msg = missing.length > 0 
      ? `Thanks for the info! Could you also tell me about your **${missing[0].label}** so I can find the best deals for you? ✨`
      : `I've noted your preferences! A property expert will contact you shortly with personalized plans. 📞`;
    aiResult = { text: msg, buttons: ["Book Site Visit", "Download Brochure"] };
  }

  session.history.push({ role: 'bot', text: aiResult.text, ts: Date.now() });

  const isComplete = !!(session.leadData.phone && session.leadData.name);
  
  // If complete, generate WhatsApp link
  let waLink = null;
  if (isComplete) {
    const waText = encodeURIComponent(`Hi Priya! I'm ${session.leadData.name}. I'm interested in KW Srishti (${session.leadData.apartment_type || 'Homes'}). My phone is ${session.leadData.phone}.`);
    waLink = `https://wa.me/${SALES_WA}?text=${waText}`;
  }

  // Attach Media & Cards
  const media = [];
  const cards = [];
  
  const type = (session.leadData.apartment_type || "").toUpperCase();
  let assetKey = null;
  if (type.includes('1BHK') || type.includes('1 BHK')) assetKey = type.includes('STUD') ? '1BHK STUDY' : '1BHK';
  else if (type.includes('2BHK') || type.includes('2 BHK')) assetKey = type.includes('STUD') ? '2BHK STUDY' : '2BHK';
  else if (type.includes('3BHK') || type.includes('3 BHK')) assetKey = '3BHK';
  else if (type.includes('PENTHOUSE')) assetKey = 'PENTHOUSE';

  // Only attach cards or media if the user showed interest in units/visuals, OR if we don't have their name yet (to hook them)
  const shouldShowMedia = intents.visuals || intents.unit || (assetKey && !session.leadData.name);

  if (assetKey && PROPERTY_ASSETS[assetKey] && shouldShowMedia) {
    const asset = PROPERTY_ASSETS[assetKey];
    const pubId = mapLocalToPublicId(asset.image);
    const optimizedCardUrl = getOptimizedUrl(pubId, { card: true }) || asset.image;
    
    cards.push({
      ...asset,
      image: optimizedCardUrl
    });

    // Only attach floor plan if explicitly requested (Intent: Visuals)
    if (intents.visuals) {
      const fpMap = { '1BHK': 'fp_1bhk.png', '2BHK': 'fp_2bhk.png', '3BHK': 'fp_3bhk.png', 'PENTHOUSE': 'fp_ph.png' };
      const fpBase = assetKey.split(' ')[0];
      if (fpMap[fpBase]) {
        const fpLocalPath = `images/${fpMap[fpBase]}`;
        const fpPubId = mapLocalToPublicId(fpLocalPath);
        const optimizedFpUrl = getOptimizedUrl(fpPubId) || fpLocalPath;
        media.push({ type: 'image', url: optimizedFpUrl });
      }
    }
  }

  // Action Buttons (Premium interactive links)
  const action_buttons = [];
  if (intents.brochure) {
    action_buttons.push({ label: '📄 Download Brochure', url: BROCHURE_URL, type: 'url' });
  }
  if (isComplete) {
    action_buttons.push({ label: '✅ Book Site Visit', url: `tel:${SITE_VISIT_TEL}`, type: 'tel' });
    action_buttons.push({ label: '💬 Chat on WhatsApp', url: waLink, type: 'url' });
  }

  const response = {
    message: aiResult.text,
    quick_replies: aiResult.buttons.length > 0 ? aiResult.buttons : null,
    action_buttons: action_buttons.length > 0 ? action_buttons : null,
    is_complete: isComplete,
    wa_link: waLink,
    media: media.length > 0 ? media : null,
    cards: cards.length > 0 ? cards : null,
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

module.exports = { buildBotResponse, calcScore, extractEntitiesAI, extractLeadData };
