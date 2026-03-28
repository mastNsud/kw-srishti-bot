const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

/**
 * Generate embedding for a given text using HuggingFace Inference API
 */
async function generateEmbedding(text) {
  if (!HF_TOKEN) {
    console.error('❌ HUGGINGFACE_TOKEN not set for embeddings');
    return null;
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBEDDING_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ HF Embedding Error:', err);
      return null;
    }

    const result = await response.json();
    return result; // This is the vector [0.1, 0.2, ...]
  } catch (err) {
    console.error('❌ Failed to generate embedding:', err);
    return null;
  }
}

/**
 * Split knowledge.txt into chunks and update the database
 */
async function syncKnowledgeBase() {
  const KNOWLEDGE_PATH = path.join(__dirname, '../knowledge.txt');
  if (!fs.existsSync(KNOWLEDGE_PATH)) {
    console.warn('⚠️ knowledge.txt not found at', KNOWLEDGE_PATH);
    return;
  }

  const db = getDB();
  const rawText = fs.readFileSync(KNOWLEDGE_PATH, 'utf8');
  
  // Split by logical sections or bullet points
  // We'll split by double newline and then further by asterisk if the section is too big
  const sections = rawText.split(/\n\n+/);
  const chunks = [];

  sections.forEach(section => {
    if (section.length > 500) {
      // Further split by lines starting with *
      const lines = section.split('\n*');
      lines.forEach(l => {
        const trimmed = l.trim();
        if (trimmed.length > 20) chunks.push(trimmed.startsWith('*') ? trimmed : '* ' + trimmed);
      });
    } else {
      const trimmed = section.trim();
      if (trimmed.length > 20) chunks.push(trimmed);
    }
  });

  console.log(`🔄 Syncing ${chunks.length} knowledge chunks to Vector DB...`);

  // Clear existing embeddings (simple sync)
  await db.query('DELETE FROM knowledge_embeddings');

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    if (embedding) {
      await db.query(
        'INSERT INTO knowledge_embeddings (content, embedding) VALUES ($1, $2)',
        [chunk, JSON.stringify(embedding)]
      );
    } else {
      console.warn('⚠️ Skipping chunk due to embedding failure:', chunk.substring(0, 50));
    }
  }

  console.log('✅ Knowledge Base Vector Sync Complete');
}

/**
 * Search for relevant context using vector similarity
 */
async function searchKnowledge(query, limit = 3) {
  const db = getDB();
  const embedding = await generateEmbedding(query);
  
  if (!embedding) {
    console.warn('⚠️ Vector search falling back: Could not generate embedding');
    return null;
  }

  try {
    // PGVector cosine similarity: <=> operator 
    // Format: embedding <=> '[v1, v2, ...]'
    const vectorStr = `[${embedding.join(',')}]`;
    const res = await db.query(
      `SELECT content, 1 - (embedding <=> $1) as similarity 
       FROM knowledge_embeddings 
       ORDER BY embedding <=> $1 
       LIMIT $2`,
      [vectorStr, limit]
    );

    return res.rows.map(r => r.content).join('\n\n');
  } catch (err) {
    console.error('❌ Vector Search Database Error:', err);
    return null;
  }
}

module.exports = {
  generateEmbedding,
  syncKnowledgeBase,
  searchKnowledge
};
