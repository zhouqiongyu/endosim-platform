/**
 * Tencent SCF 云函数：Coze OAuth token 代理
 *
 * 部署后通过 API 网关触发，提供两个接口：
 * - GET  /release/coze-token  -> 返回缓存的 Coze access_token
 * - POST /release/coze-token  -> 强制刷新并返回新的 access_token
 *
 * 前端通过 window.COZE_TOKEN_URL 指向该地址，实现前后端分离部署。
 */

const jwt = require('jsonwebtoken');
const https = require('https');

const COZE_BOT_ID = process.env.COZE_BOT_ID;
const COZE_PAT_TOKEN = process.env.COZE_PAT_TOKEN;     // 可选：若配置则直接返回 PAT
const COZE_APP_ID = process.env.COZE_APP_ID;
const COZE_PRIVATE_KEY = process.env.COZE_PRIVATE_KEY; // RSA 私钥 PEM
const COZE_KID = process.env.COZE_KID;                 // 公钥 ID
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'; // 前端域名，例如 https://xxx.tcloudbaseapp.com

const COZE_TOKEN_URL = 'https://api.coze.cn/api/permission/oauth2/token';
const COZE_AUDIENCE = 'api.coze.cn';

// 内存级 token 缓存（SCF 容器复用时有效）
let tokenCache = {
  accessToken: null,
  expiresAt: 0, // 毫秒时间戳
};

function getHeader(headers, name) {
  if (!headers) return undefined;
  const lowerName = name.toLowerCase();
  const key = Object.keys(headers).find(k => k.toLowerCase() === lowerName);
  return key ? headers[key] : undefined;
}

function makeResponse(statusCode, body, reqHeaders) {
  const requestOrigin = getHeader(reqHeaders, 'origin');
  const allowOrigin = FRONTEND_ORIGIN === '*' ? '*' : (requestOrigin || FRONTEND_ORIGIN || '*');

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // 只有指定具体域名时才允许携带凭证
  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function requestTokenFromCoze(jwtToken) {
  return new Promise((resolve, reject) => {
    const url = new URL(COZE_TOKEN_URL);
    const postData = JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      duration_seconds: 86399,
    });

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Coze token endpoint returned ${res.statusCode}: ${data}`));
          } else {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Invalid JSON from Coze: ${data}`));
            }
          }
        });
      }
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchCozeAccessToken(forceRefresh = false) {
  if (!forceRefresh && tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60 * 1000) {
    return tokenCache.accessToken;
  }

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
      exp: now + 3600,
      jti: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    COZE_PRIVATE_KEY,
    {
      algorithm: 'RS256',
      header: { alg: 'RS256', typ: 'JWT', kid: COZE_KID },
    }
  );

  const data = await requestTokenFromCoze(jwtToken);

  // expires_in 可能是秒数，也可能是绝对毫秒时间戳
  let expiresInSeconds = data.expires_in;
  if (typeof expiresInSeconds === 'number' && expiresInSeconds > 1000000000) {
    expiresInSeconds = Math.floor((expiresInSeconds * 1000 - Date.now()) / 1000);
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (expiresInSeconds || 3600) * 1000,
  };

  return data.access_token;
}

exports.main_handler = async (event, context) => {
  const httpMethod = (event.httpMethod || event.requestContext?.http?.method || 'GET').toUpperCase();
  const headers = event.headers || {};

  if (httpMethod === 'OPTIONS') {
    return makeResponse(204, {}, headers);
  }

  try {
    if (COZE_PAT_TOKEN) {
      return makeResponse(200, {
        botId: COZE_BOT_ID,
        token: COZE_PAT_TOKEN,
        expiresAt: null,
      }, headers);
    }

    const forceRefresh = httpMethod === 'POST';
    const token = await fetchCozeAccessToken(forceRefresh);

    return makeResponse(200, {
      botId: COZE_BOT_ID,
      token,
      expiresAt: tokenCache.expiresAt,
    }, headers);
  } catch (err) {
    console.error('[SCF] Failed to fetch Coze token:', err.message);
    return makeResponse(500, {
      error: 'Failed to fetch Coze access token',
      detail: err.message,
    }, headers);
  }
};
