const fetch = require('node-fetch');

// ── CONVERSATION FLOW ──
const FLOW = [
  {
    id: 'greeting',
    bot: `Namaste! 🙏 I'm **Priya**, your personal advisor for **KW Srishti** — Ghaziabad's most sought-after luxury address on NH-58, Raj Nagar Extension.\n\nI'd love to help you find your perfect home here. May I start with your **good name**?`,
    collect: 'name',
    type: 'input',
    inputHint: 'Your full name'
  },
  {
    id: 'apartment_type',
    bot: (d) => `Lovely to meet you, **${d.name}**! 😊\n\nKW Srishti offers thoughtfully designed homes from compact 1 BHKs to grand 4 BHK penthouses — with GDA approval, freehold land & 40+ luxury amenities.\n\n**Which type of home are you looking for?**`,
    collect: 'apartment_type',
    type: 'quick_reply',
    options: ['1 BHK (740–875 sq.ft.)', '2 BHK (985–1,310 sq.ft.)', '3 BHK (1,485–1,500 sq.ft.)', 'Penthouse (1,900–2,650 sq.ft.)', 'Show me all options']
  },
  {
    id: 'purpose',
    bot: (d) => {
      const units = {
        '1 BHK (740–875 sq.ft.)': 'Our 1 BHK units are perfectly sized with spacious balconies and a dedicated kitchen.',
        '2 BHK (985–1,310 sq.ft.)': 'Excellent choice! Our 2 BHK homes offer two comfortable bedrooms with great sunlight.',
        '3 BHK (1,485–1,500 sq.ft.)': 'Perfect for families! Our 3 BHK towers offer generous living spaces.',
        'Penthouse (1,900–2,650 sq.ft.)': 'Exquisite taste! Our penthouses are duplex units with private terraces — truly sky living.',
        'Show me all options': 'We have something for every need — from cozy 1 BHKs to sprawling penthouses!'
      };
      return `${units[d.apartment_type] || 'Great choice!'}\n\n**What's your purpose for this purchase?**`;
    },
    collect: 'purpose',
    type: 'quick_reply',
    options: ['Self-occupation 🏠', 'Investment / Rental 📈', 'Both']
  },
  {
    id: 'budget',
    bot: (d) => {
      const inv = d.purpose?.includes('Investment');
      return inv
        ? `Smart move! KW Srishti's location on NH-58 with **proposed Metro connectivity** and a shopping complex inside the campus makes it an excellent rental investment.\n\n**What's your approximate budget?**`
        : `Wonderful! You'll love the lifestyle here — 80% green area, guitar-shaped pool, and a community designed for everyday luxury.\n\n**What's your approximate budget?**`;
    },
    collect: 'budget',
    type: 'quick_reply',
    options: ['Under ₹40 Lakh', '₹40–60 Lakh', '₹60–90 Lakh', '₹90 Lakh+', 'Need home loan guidance']
  },
  {
    id: 'timeline',
    bot: (d) => {
      const loan = d.budget === 'Need home loan guidance';
      return loan
        ? `No worries! KW Srishti has **Construction-Linked Payment Plans (CLP)** and home loans approved by 10+ banks — SBI, HDFC, ICICI, Axis, LIC HFL & more. Our advisor can walk you through EMI options.\n\n**When are you planning to make a decision?**`
        : `Great! We have excellent options in the **${d.budget}** range with flexible CLP payment plans.\n\n**What's your buying timeline?**`;
    },
    collect: 'timeline',
    type: 'quick_reply',
    options: ['Within 1 month 🔥', '1–3 months', '3–6 months', 'Just exploring for now']
  },
  {
    id: 'phone',
    bot: (d) => {
      const hot = d.timeline?.includes('1 month');
      return hot
        ? `That's very exciting — we'd love to have you visit before units fill up!\n\nMay I have your **mobile number** so our advisor can call you within 2 hours to confirm a site visit? 🏗️`
        : `Perfect! I'll have our advisor share the latest price list, floor plans, and arrange a site visit at your convenience.\n\nMay I have your **mobile number**?`;
    },
    collect: 'phone',
    type: 'input',
    inputHint: '10-digit mobile number',
    validate: (v) => /^\+?[\d\s-]{10,15}$/.test(v.trim()) ? null : 'Please enter a valid 10-digit mobile number'
  },
  {
    id: 'email',
    bot: () => `Thank you! 📲\n\nMay I also have your **email address** to send you the complete brochure, floor plans & current offers? *(optional — type 'skip' if you prefer not to)*`,
    collect: 'email',
    type: 'input',
    inputHint: 'email@example.com or type skip',
    optional: true
  },
  {
    id: 'complete',
    bot: (d) => {
      const score = calcScore(d);
      const priority = score >= 70 ? '🔴 Priority' : score >= 50 ? '🟡 Warm' : '🟢 Nurture';
      return `Thank you, **${d.name}**! 🎉 You're all set.\n\nHere's your interest summary:\n• 🏠 Unit: **${d.apartment_type}**\n• 🎯 Purpose: **${d.purpose}**\n• 💰 Budget: **${d.budget}**\n• 📅 Timeline: **${d.timeline}**\n\nOur senior advisor will contact you at **${d.phone}** very shortly!\n\nIn the meantime, feel free to ask me **anything** about KW Srishti. I know everything about this property! 😊`;
    },
    collect: null,
    type: 'complete'
  }
];

// ── FAQ KNOWLEDGE BASE ──
const FAQ = [
  {
    patterns: ['location', 'where', 'address', 'how to reach', 'route', 'near', 'distance'],
    answer: `📍 **KW Srishti is located at NH-58, Raj Nagar Extension, Ghaziabad.**\n\nKey connectivity:\n• Direct access from NH-58 (Meerut Bypass)\n• Easy reach from Vasundhara, Indirapuram & GT Road\n• Close to Hindon Air Force Base\n• **Proposed Metro connectivity** coming soon\n• ~30 mins from Delhi (Anand Vihar / Gazipur Border)`
  },
  {
    patterns: ['price', 'cost', 'rate', 'how much', 'affordable', 'pricing'],
    answer: `💰 **KW Srishti Pricing Overview:**\n\n• 1 BHK (740 sq.ft.) — Contact for price\n• 1 BHK+Study (875 sq.ft.) — Contact for price\n• 2 BHK (985–1,000 sq.ft.) — Contact for price\n• 2 BHK+Study (1,220–1,310 sq.ft.) — Contact for price\n• 3 BHK (1,485–1,500 sq.ft.) — Contact for price\n• Penthouse (1,900–2,650 sq.ft.) — Contact for price\n\nFor the **latest price list & current offers**, our advisor can share it directly. Want me to arrange that?`
  },
  {
    patterns: ['amenities', 'facilities', 'pool', 'gym', 'club', 'sports'],
    answer: `🏊 **KW Srishti has 40+ world-class amenities:**\n\n**Sports:** Lawn Tennis, Badminton, Cricket Net, Skating Rink\n**Wellness:** Swimming Pool (guitar-shaped!), Kids Pool, Jacuzzi, Gymnasium, Steam & Sauna Bath\n**Community:** Amphi Theatre, Community Hall, Party Lawn, TV Lounge, Billiards\n**Kids:** Children's Park, Nursery School, Creche\n**Convenience:** Shopping Complex inside campus, Internet in every flat\n**Nature:** 80% green area, Landscaped Gardens, Jogging Track, Water Falls, Musical Fountain`
  },
  {
    patterns: ['loan', 'bank', 'finance', 'emi', 'clp', 'payment'],
    answer: `🏦 **Home Loans approved by 10+ banks:**\nSBI • HDFC • ICICI • Axis Bank • PNB Housing Finance • LIC HFL • DHFL • Tata Capital • Allahabad Bank • UCO Bank • Syndicate Bank • Indian Bank\n\n**Payment Plan:** Construction-Linked Payment Plan (CLP) available — you pay as construction progresses.\n\nShall I connect you with our finance advisor for an EMI calculation?`
  },
  {
    patterns: ['security', 'safe', 'cctv', 'guard'],
    answer: `🔒 **Security at KW Srishti:**\n• Round-the-clock manned security\n• CCTV surveillance across the entire campus\n• Secure access at the lavish entrance gate\n• 24-hour monitoring for complete peace of mind`
  },
  {
    patterns: ['gda', 'approved', 'legal', 'freehold', 'authority'],
    answer: `✅ **KW Srishti is 100% legally secure:**\n• **GDA (Ghaziabad Development Authority) Approved Plan**\n• **Freehold Land** — you own the land outright, no leasehold complications\n• Earthquake-resistant RCC framed structure\n• Member of **CREDAI** (the apex body of real estate developers)`
  },
  {
    patterns: ['water', 'power', 'backup', 'electricity', 'supply'],
    answer: `⚡ **Uninterrupted Services:**\n• **24-hour water supply** with water treatment plant (WTP) and softener system\n• **Individual RO purifier in every kitchen**\n• **24-hour power backup** across all towers and common areas\n• Rain Water Harvesting system\n• Sewage Treatment Plant (STP)`
  },
  {
    patterns: ['visit', 'site visit', 'tour', 'show flat', 'model flat'],
    answer: `🏗️ **Schedule a Site Visit:**\nWe'd love to show you around KW Srishti in person! The campus is beautiful and seeing it live makes all the difference.\n\nOur site office is open **Mon–Sun, 10 AM – 6 PM** at NH-58, Raj Nagar Extension, Ghaziabad.\n\nCan I book a visit for you? Share your preferred date and time!`
  },
  {
    patterns: ['penthouse', 'duplex', 'terrace', 'sky'],
    answer: `🌟 **KW Srishti Penthouses:**\nWe have 4 penthouse configurations:\n\n• **Tower D** — 3 BHK+4T+Store, 1,900 sq.ft., private terrace\n• **Tower E** — 4 BHK+4T+Store, 2,000 sq.ft., 2 terraces\n• **Tower F&G** — 3 BHK+4T+Study+Store, 2,270 sq.ft., 2 terraces\n• **Tower J** — 4 BHK+4T+Store, 2,650 sq.ft. — the crown jewel!\n\nAll penthouses are duplex units with breathtaking views. Interested in any specific tower?`
  },
  {
    patterns: ['award', 'credai', 'recognition', 'best'],
    answer: `🏆 **KW Group Awards & Recognition:**\n• Best Developer of the Year (Construction) — 2011\n• Best Housing Design of the Year — 2012\n• Best Brand of the Year — 2013\n• Member of **CREDAI** (Confederation of Real Estate Developers' Associations of India)\n\nKW Group's corporate office is at Plot B-97, Sector 63, Noida.`
  },
  {
    patterns: ['metro', 'transport', 'connectivity', 'bus', 'train'],
    answer: `🚇 **Transport & Connectivity:**\n• Located on **NH-58** — excellent road connectivity\n• **Proposed Metro station** planned near Raj Nagar Extension\n• Close to major roads: GT Road, NH-24 Bypass\n• Near Mohan Nagar Tiraha intersection\n• Accessible from ISBT Anand Vihar, Vaishali Metro`
  },
  {
    patterns: ['school', 'hospital', 'mall', 'market'],
    answer: `🏫 **Social Infrastructure Nearby:**\n• Schools and colleges within close reach\n• Hospitals and clinics in the vicinity\n• Shopping: Shipra Mall, MMX Mall accessible\n• KW Srishti itself has a **Shopping Complex and Nursery School inside the campus!**`
  }
];

// ── AI FALLBACK via Claude API ──
async function askClaude(question, context) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are Priya, a friendly and knowledgeable sales advisor for KW Srishti, a luxury residential project in Ghaziabad. 
Your job is to answer questions about the property and gently guide prospects toward booking a site visit.
Keep answers concise (under 120 words), warm, and helpful. Use bullet points when listing features.
If asked something you don't know, invite them to call +91-9310908888.
Never quote exact prices — say "contact us for latest pricing".
Key facts: Location: NH-58 Raj Nagar Extn Ghaziabad | Units: 1BHK-4BHK+Penthouse | GDA Approved | Freehold | 40+ amenities | Guitar-shaped pool | 80% green | 24hr power+water | 10+ bank loans | Awards: Best Developer 2011, Best Housing Design 2012, Best Brand 2013`,
        messages: [{ role: 'user', content: question }]
      })
    });
    const data = await resp.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    return null;
  }
}

function calcScore(d) {
  let s = 0;
  if (d.name) s += 10;
  if (d.phone) s += 25;
  if (d.email && d.email !== 'skip') s += 15;
  if (['Within 1 month 🔥', '1–3 months'].includes(d.timeline)) s += 20;
  if (['3 BHK (1,485–1,500 sq.ft.)', 'Penthouse (1,900–2,650 sq.ft.)'].includes(d.apartment_type)) s += 10;
  if (d.budget === '₹90 Lakh+') s += 10;
  if (d.purpose?.includes('Self')) s += 10;
  return Math.min(s, 100);
}

// ── MAIN RESPONSE BUILDER ──
async function buildBotResponse(session, userInput, req) {
  const step = session.step || 0;
  const currentFlowStep = FLOW[step];

  // If flow is complete, handle free-form questions
  if (!currentFlowStep || currentFlowStep.type === 'complete') {
    return handleFreeQuestion(userInput, session);
  }

  // Validate input if needed
  if (currentFlowStep.validate && userInput) {
    const err = currentFlowStep.validate(userInput);
    if (err) {
      return {
        message: err,
        type: 'error',
        quick_replies: null
      };
    }
  }

  // Handle optional skip
  const isSkip = userInput.toLowerCase() === 'skip';

  // Save collected data
  if (currentFlowStep.collect && userInput) {
    session.leadData[currentFlowStep.collect] = isSkip ? null : userInput;
    session.history = session.history || [];
    session.history.push({ role: 'user', text: userInput, ts: Date.now() });
  }

  // Advance step
  session.step = step + 1;
  const nextStep = FLOW[session.step];

  if (!nextStep) {
    return { message: 'Thank you for your interest! Our team will be in touch shortly.', type: 'text' };
  }

  const botText = typeof nextStep.bot === 'function' ? nextStep.bot(session.leadData) : nextStep.bot;
  session.history.push({ role: 'bot', text: botText, ts: Date.now() });

  return {
    message: botText,
    type: nextStep.type,
    quick_replies: nextStep.type === 'quick_reply' ? nextStep.options : null,
    input_hint: nextStep.inputHint || null,
    step: session.step,
    is_complete: nextStep.type === 'complete'
  };
}

async function handleFreeQuestion(text, session) {
  const lower = text.toLowerCase();

  // Check FAQ
  for (const faq of FAQ) {
    if (faq.patterns.some(p => lower.includes(p))) {
      return { message: faq.answer, type: 'text', quick_replies: ['Book Site Visit', 'Get Price List', 'Talk to Advisor'] };
    }
  }

  // Try Claude AI
  const aiAnswer = await askClaude(text, session.leadData);
  if (aiAnswer) {
    return { message: aiAnswer, type: 'text', quick_replies: ['Book Site Visit', 'Get Price List', 'More Info'] };
  }

  // Fallback
  return {
    message: `That's a great question! For the most accurate answer, our advisor would be best placed to help.\n\n📞 **Call/WhatsApp:** +91-9310 90 8888\n✉️ **Email:** saleskws@kwgroup.in\n\nOr would you like me to arrange a **callback** for you?`,
    type: 'text',
    quick_replies: ['Yes, arrange callback', 'Book Site Visit', 'Ask something else']
  };
}

module.exports = { buildBotResponse };
