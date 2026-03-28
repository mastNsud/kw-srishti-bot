const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { getOptimizedUrl, mapLocalToPublicId } = require('./utils/cloudinaryService');

// ── CONFIG ──
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const PRIMARY_MODEL = process.env.HF_PRIMARY_MODEL || 'meta-llama/Llama-3.2-1B-Instruct';
const SALES_WA = process.env.SALES_WHATSAPP_NUMBER || '14155238886';

// Load Grounded Knowledge
// Load Grounded Knowledge (Segmented for precision)
const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge.txt');
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

  // Simple RAG retrieval: find top 2 sections most relevant to user input
  const lowerInput = userInput.toLowerCase();
  const relevantSections = Object.keys(KNOWLEDGE_SEGMENTS)
    .filter(k => k !== 'all' && k !== 'default')
    .filter(k => lowerInput.includes(k.toLowerCase()) || KNOWLEDGE_SEGMENTS[k].toLowerCase().includes(lowerInput))
    .map(k => KNOWLEDGE_SEGMENTS[k]);
  
  const context = relevantSections.length > 0 ? relevantSections.join('\n\n') : KNOWLEDGE_SEGMENTS.all;

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
3. **PERSONALIZATION (CRITICAL)**:
   - If you know the user's name from CURRENT DATA, you MUST use their first name in your response (e.g., "Yes, Rahul, we have...").
   - If you know their location, highlight how convenient KW Srishti is for them.
   - Try to infer demographics to recommend 2BHK vs 3BHK.
4. **LEAD NUDGING (CRITICAL)**:
   - DO NOT BLOCK the user from getting answers. Answer their queries regarding floor plans, brochures, or site visits.
   - HOWEVER, until a phone number is provided, ALWAYS gently nudge them to share their WhatsApp number at the end of your response for a better explanation or to send documents.
5. If they give a phone number, tell them: "Excellent! Our consultant will call you shortly with the best deals! ✨"
6. PROVIDE SUGGESTED BUTTONS in this format: [BUTTON: Label]. Max 4 buttons.
7. **VISUALS**: You can now "show" floor plans and property cards. Keep text under 100 words.

PROJECT KNOWLEDGE (Relevant Context):
${context}

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

// ── AI ENTITY EXTRACTION (Multi-Provider) ──
async function extractEntitiesAI(text) {
  const token = process.env.HUGGINGFACE_TOKEN;
  const orKey = process.env.OPENROUTER_API_KEY;
  
  if (!token && !orKey) {
    console.warn('⚠️ No AI tokens found for extraction (HF or OpenRouter)');
    return null;
  }

  const extractionPrompt = `Extract real estate lead details from this message into a JSON object. 
Fields: name, phone (10 digits), apartment_type (e.g. 2BHK), budget, purpose (Investment/Self), timeline, location, demographics.
If a field is not present, set it to null.
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
  const phoneMatch = text.match(/\d{10}/);
  if (phoneMatch && !collected.phone) collected.phone = phoneMatch[0];

  // Smarter Budget (Lakhs/Crores)
  const budgetMatch = text.match(/(\d+\.?\d*)\s*(lakh|lac|cr|crore|cr\.)/i);
  if (budgetMatch && !collected.budget) {
    collected.budget = budgetMatch[0];
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

  if (userInput) {
    session.history.push({ role: 'user', text: userInput, ts: Date.now() });
    await extractLeadData(userInput, session.leadData);
  }

  let aiResult = await askAI(session, userInput || "How can I help you today?");
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

  if (assetKey && PROPERTY_ASSETS[assetKey]) {
    const asset = PROPERTY_ASSETS[assetKey];
    const pubId = mapLocalToPublicId(asset.image);
    const optimizedCardUrl = getOptimizedUrl(pubId, { card: true }) || asset.image;
    
    cards.push({
      ...asset,
      image: optimizedCardUrl
    });

    // Also attach floor plan as image if available
    const fpMap = { '1BHK': 'fp_1bhk.png', '2BHK': 'fp_2bhk.png', '3BHK': 'fp_3bhk.png', 'PENTHOUSE': 'fp_ph.png' };
    const fpBase = assetKey.split(' ')[0];
    if (fpMap[fpBase]) {
      const fpLocalPath = `images/${fpMap[fpBase]}`;
      const fpPubId = mapLocalToPublicId(fpLocalPath);
      const optimizedFpUrl = getOptimizedUrl(fpPubId) || fpLocalPath;
      media.push({ type: 'image', url: optimizedFpUrl });
    }
  }

  const response = {
    message: aiResult.text,
    quick_replies: aiResult.buttons.length > 0 ? aiResult.buttons : null,
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
