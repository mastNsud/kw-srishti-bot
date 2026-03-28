require('dotenv').config();
const { initDB, getDB } = require('../src/db');

async function test() {
  console.log('--- Database Connection Test ---');
  try {
    await initDB();
    const db = getDB();
    
    // Test 1: Count leads
    const countRes = await db.prepare('SELECT COUNT(*) as c FROM leads').get();
    console.log('✅ Success: Leads count =', countRes.c);

    // Test 2: Insert a dummy session
    const sid = 'test-session-' + Date.now();
    await db.prepare('INSERT INTO sessions (id, data) VALUES ($1, $2)').run(sid, JSON.stringify({ test: true }));
    console.log('✅ Success: Dummy session inserted');

    // Test 3: Retrieve and delete dummy session
    const row = await db.prepare('SELECT data FROM sessions WHERE id=$1').get(sid);
    if (JSON.parse(row.data).test) {
      console.log('✅ Success: Session data retrieved correctly');
    }
    await db.prepare('DELETE FROM sessions WHERE id=$1').run(sid);
    console.log('✅ Success: Dummy session cleaned up');

    console.log('\n🎉 All tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
  } finally {
    process.exit(0);
  }
}

test();
