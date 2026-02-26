#!/usr/bin/env node
/**
 * Canva OAuth helper (Render-deployable)
 *
 * Usage:
 *  - npm install
 *  - Set env vars (see README)
 *  - npm start
 */

const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const AUTH_URL = process.env.CANVA_AUTH_URL || 'https://www.canva.com/api/oauth/authorize';
const TOKEN_URL = process.env.CANVA_TOKEN_URL || 'https://api.canva.com/rest/v1/oauth/token';
const REDIRECT_URI = process.env.CANVA_REDIRECT_URI;
const SCOPES = process.env.CANVA_SCOPES || 'openid profile design:read design:write';
const TOKEN_PATH = process.env.CANVA_TOKEN_PATH || path.join(__dirname, 'tokens', 'canva-tokens.json');

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Missing required env vars. Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REDIRECT_URI.');
  process.exit(1);
}

if (!fs.existsSync(path.dirname(TOKEN_PATH))) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
}

const pendingStates = new Set();
const stateVerifiers = new Map();
const app = express();

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

app.get('/', (req, res) => {
  res.send(`Canva OAuth helper is running.<br/>` +
    `<a href="/canva/auth">Start OAuth</a><br/><br/>` +
    `Tokens stored at ${TOKEN_PATH}`);
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.get('/canva/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);

  const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
  const codeChallenge = base64UrlEncode(sha256(Buffer.from(codeVerifier)));
  stateVerifiers.set(state, codeVerifier);

  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  res.redirect(url.toString());
});

app.get('/canva/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing ?code');
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('Invalid OAuth state. Start over.');
  }
  pendingStates.delete(state);
  const verifier = stateVerifiers.get(state);
  stateVerifiers.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code, verifier);
    saveTokens(tokens);
    res.send('✅ Canva tokens stored. You can close this tab.');
  } catch (error) {
    console.error('Token exchange failed:', error.message);
    res.status(500).send(`Token exchange failed: ${error.message}`);
  }
});

app.get('/canva/tokens', (req, res) => {
  if (!fs.existsSync(TOKEN_PATH)) {
    return res.status(404).json({ error: 'No tokens stored yet' });
  }
  res.json(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));
});

app.listen(PORT, () => {
  console.log(`Canva OAuth helper listening on port ${PORT}`);
});

async function exchangeCodeForTokens(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Canva token endpoint responded ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { ...data, obtained_at: Date.now() };
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`Saved tokens to ${TOKEN_PATH}`);
}
