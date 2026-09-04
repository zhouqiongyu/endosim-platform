// Test that /api/coze/token returns a token Coze accepts, without printing the token
require('dotenv').config();

async function test() {
  const res = await fetch('http://localhost:3000/api/coze/token');
  if (!res.ok) {
    console.error('Token endpoint failed:', res.status);
    process.exit(1);
  }
  const data = await res.json();
  console.log('botId type:', typeof data.botId, 'botId length:', String(data.botId).length);

  // Verify against Coze bot info API
  const botRes = await fetch(`https://api.coze.cn/v1/bots/${data.botId}`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  const botData = await botRes.json();
  console.log('Coze bot API status:', botRes.status, 'code:', botData.code);
  if (botData.code !== 0) {
    console.error('Coze API error:', botData.msg || botData.detail);
    process.exit(1);
  }
  console.log('Token is valid and bot info retrieved successfully');
}

test().catch(e => {
  console.error('Test error:', e.message);
  process.exit(1);
});
