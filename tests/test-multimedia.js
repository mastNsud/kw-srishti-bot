const botEngine = require('../src/botEngine');
const { buildBotResponse } = botEngine;

// Mock askAI to bypass real API calls
botEngine.askAI = async () => ({ text: "Sure, here are some options for you!", buttons: [] });

async function testMultimedia() {
    console.log('🧪 Testing Multimedia Responses (Mocking AI)...');

    const session = {
        leadData: { name: 'Test User' },
        history: []
    };

    // Test Case 1: Ask for 3BHK
    console.log('\n--- Test Case 1: Show me 3BHK ---');
    const r1 = await buildBotResponse(session, 'Show me some 3BHK info');
    console.log('Bot Message:', r1.message);
    console.log('Media:', JSON.stringify(r1.media, null, 2));
    console.log('Cards:', JSON.stringify(r1.cards, null, 2));

    // Test Case 2: Ask for Penthouse
    console.log('\n--- Test Case 2: I want a penthouse ---');
    const r2 = await buildBotResponse(session, 'I am looking for a penthouse');
    console.log('Bot Message:', r2.message);
    console.log('Media:', JSON.stringify(r2.media, null, 2));
    console.log('Cards:', JSON.stringify(r2.cards, null, 2));

    if ((r1.media || r1.cards) && (r2.media || r2.cards)) {
        console.log('\n✅ Multimedia Verification Passed!');
    } else {
        console.log('\n❌ Multimedia Verification Failed.');
    }
}

testMultimedia();
