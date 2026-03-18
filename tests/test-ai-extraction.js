const { extractEntitiesAI, extractLeadData } = require('../src/botEngine');
require('dotenv').config();

async function testExtraction() {
  console.log('🧪 Testing AI Structured Extraction...');
  
  const testInputs = [
    "Hi, I'm Rohan. Looking for a 3BHK in Ghaziabad around 1.2 Crore. Need to move in 3 months.",
    "My number is 9876543210. Just checking the swimming pool details.",
    "I am an investor from Delhi, interested in luxury units."
  ];

  for (const input of testInputs) {
    console.log(`\nUser: "${input}"`);
    const collected = {};
    await extractLeadData(input, collected);
    console.log('Extracted Data:', JSON.stringify(collected, null, 2));
  }
}

testExtraction();
