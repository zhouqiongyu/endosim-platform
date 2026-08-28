require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Coze credentials
const COZE_BOT_ID = process.env.COZE_BOT_ID;
const COZE_PAT_TOKEN = process.env.COZE_PAT_TOKEN;     // 后端托管的 PAT token
const COZE_APP_ID = process.env.COZE_APP_ID;           // OAuth appId
const COZE_PRIVATE_KEY = process.env.COZE_PRIVATE_KEY; // RSA private key PEM
const COZE_KID = process.env.COZE_KID;                 // Public key ID
const COZE_TOKEN_URL = 'https://api.coze.cn/api/permission/oauth2/token';
const COZE_AUDIENCE = 'api.coze.cn';

// In-memory token cache (only used for OAuth mode)
let tokenCache = {
  accessToken: null,
  expiresAt: 0, // epoch ms
};

/**
 * Generate a new Coze service OAuth access token using JWT assertion.
 * Coze JWT flow does not issue refresh tokens; instead we generate a fresh
 * JWT and exchange it for a new access token.
 */
async function fetchCozeAccessToken() {
  if (!COZE_APP_ID || !COZE_PRIVATE_KEY || !COZE_KID) {
    throw new Error('Coze OAuth credentials not configured (COZE_APP_ID, COZE_PRIVATE_KEY, COZE_KID)');
  }

  const now = Math.floor(Date.now() / 1000);
  const jwtToken = jwt.sign(
    {
      iss: COZE_APP_ID,
      sub: COZE_APP_ID,
      aud: COZE_AUDIENCE,
      iat: now,
      exp: now + 3600, // 1 hour
      jti: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    COZE_PRIVATE_KEY,
    {
      algorithm: 'RS256',
      header: {
        alg: 'RS256',
        typ: 'JWT',
        kid: COZE_KID,
      },
    }
  );

  const res = await fetch(COZE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      duration_seconds: 86399,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coze token endpoint returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Coze may return access_token + expires_in (absolute timestamp or seconds)
  const expiresInSeconds = typeof data.expires_in === 'number' && data.expires_in > 1000000000
    ? Math.floor((data.expires_in * 1000 - Date.now()) / 1000)
    : data.expires_in;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (expiresInSeconds || 3600) * 1000,
  };

  return data.access_token;
}

/**
 * Return a valid cached token or fetch a new one.
 */
async function getCozeAccessToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60 * 1000) {
    return tokenCache.accessToken;
  }
  return fetchCozeAccessToken();
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Provide access token to the frontend
app.get('/api/coze/token', async (req, res) => {
  try {
    // 如果配置了 PAT，则直接由后端返回给前端（不写入前端源码）
    if (COZE_PAT_TOKEN) {
      return res.json({
        botId: COZE_BOT_ID,
        token: COZE_PAT_TOKEN,
        expiresAt: null,
      });
    }

    // 否则走 OAuth JWT 换取短期 access_token
    const accessToken = await getCozeAccessToken();
    res.json({
      botId: COZE_BOT_ID,
      token: accessToken,
      expiresAt: tokenCache.expiresAt,
    });
  } catch (err) {
    console.error('Failed to fetch Coze access token:', err.message);
    res.status(500).json({ error: 'Failed to fetch Coze access token', detail: err.message });
  }
});

// Force refresh access token
app.post('/api/refresh-coze-token', async (req, res) => {
  try {
    if (COZE_PAT_TOKEN) {
      return res.json({
        botId: COZE_BOT_ID,
        token: COZE_PAT_TOKEN,
        expiresAt: null,
      });
    }

    const accessToken = await getCozeAccessToken(true);
    res.json({
      botId: COZE_BOT_ID,
      token: accessToken,
      expiresAt: tokenCache.expiresAt,
    });
  } catch (err) {
    console.error('Failed to refresh Coze access token:', err.message);
    res.status(500).json({ error: 'Failed to refresh Coze access token', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`EndoSim server running on http://localhost:${PORT}`);
});
