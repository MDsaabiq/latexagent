/**
 * server.js — TikZ AI backend
 *
 * Architecture:
 *   Browser → POST /api/chat → IBM IAM → IBM WML (Granite-3) → TikZ code
 *
 * The watsonx Orchestrate "LaTeX Diagram Generator Agent" is configured in
 * the IBM Console (with the system prompt) for demonstration purposes.
 * The system prompt shown in Orchestrate is IDENTICAL to the one sent
 * here to Granite — same agent behavior, visible in the IBM UI.
 *
 * Usage:
 *   1. Fill in .env
 *   2. node server.js
 *   3. Open http://localhost:3000
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ── Load .env ────────────────────────────────────────────────────────────────
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const eq = clean.indexOf('=');
    if (eq < 1) return;
    const key = clean.slice(0, eq).trim();
    const val = clean.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
})();

const PORT        = process.env.PORT        || 3000;
const IBM_API_KEY = process.env.IBM_API_KEY;
const WML_PROJECT_ID = process.env.WML_PROJECT_ID;
const WML_URL     = process.env.WML_URL     || 'https://eu-de.ml.cloud.ibm.com';
const WML_HOST    = new URL(WML_URL).hostname; // eu-de.ml.cloud.ibm.com
// Best available Granite model on eu-de Lite plan (granite-3-3-8b-instruct not in eu-de)
const MODEL_ID    = process.env.WML_MODEL_ID || 'ibm/granite-4-h-small';

// Orchestrate info (for display only — shown in /health and UI)
const ORCHESTRATE_INSTANCE_ID = process.env.ORCHESTRATE_INSTANCE_ID || '4e8347a4-1eeb-401e-bf86-67ab836dda4d';
const AGENT_ID                = process.env.AGENT_ID                || '2b603010-b791-4933-ba16-dbc9c953b4fb';

// ── The exact system prompt used in your watsonx Orchestrate agent ───────────
// This is IDENTICAL to what is configured in the IBM Console agent "Behavior > Instructions"
const SYSTEM_PROMPT = `You are an AI-Powered LaTeX Diagram Generator Agent for Academic Research.

Your sole purpose is to convert natural language descriptions into precise, valid LaTeX TikZ code.

OUTPUT RULES — follow strictly:
1. Output ONLY valid LaTeX code. No explanation. No markdown fences (no \`\`\`latex).
2. Start with \\documentclass{standalone}
3. Include \\usepackage{tikz} and \\usetikzlibrary{arrows.meta,shapes.geometric,positioning,shadows}
4. Wrap code in \\begin{document}...\\end{document}
5. Keep elements clearly aligned, labeled, and compatible with Overleaf.

FORMAT:
\\documentclass{standalone}
\\usepackage{tikz}
\\usetikzlibrary{arrows.meta,shapes.geometric,positioning}
\\begin{document}
\\begin{tikzpicture}
[generated TikZ code here]
\\end{tikzpicture}
\\end{document}`;

// ── IBM IAM: get Bearer token ────────────────────────────────────────────────
function getIAMToken(apiKey) {
  return new Promise((resolve, reject) => {
    const body = 'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=' + encodeURIComponent(apiKey);
    const req  = https.request({
      hostname: 'iam.cloud.ibm.com',
      path:     '/identity/token',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.access_token) resolve(j.access_token);
          else reject(new Error('IAM error: ' + data));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Call IBM Granite-3 via WML ───────────────────────────────────────────────
function callGranite(token, projectId, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model_id:   MODEL_ID,
      project_id: projectId,
      input:      `<|system|>\n${SYSTEM_PROMPT}\n<|user|>\n${userPrompt}\n<|assistant|>\n`,
      parameters: {
        decoding_method:    'greedy',
        max_new_tokens:     1500,
        temperature:        0.3,
        repetition_penalty: 1.05
      }
    });

    const req = https.request({
      hostname: WML_HOST,
      path:     '/ml/v1/text/generation?version=2024-05-31',
      method:   'POST',
      headers:  {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept':         'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (res.statusCode !== 200) reject(new Error('WML error ' + res.statusCode + ': ' + data));
          else resolve(j.results[0].generated_text);
        } catch(e) { reject(new Error('WML parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── POST body reader ─────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// ── Static file helper ───────────────────────────────────────────────────────
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  // Serve index.html
  if (req.method === 'GET' && parsed.pathname === '/') {
    return serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
  }

  // Health check
  if (req.method === 'GET' && parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status:          'ok',
      agentConfigured: !!(IBM_API_KEY && WML_PROJECT_ID),
      model:           MODEL_ID,
      wmlHost:         WML_HOST,
      orchestrateInstanceId: ORCHESTRATE_INSTANCE_ID,
      agentId:         AGENT_ID
    }));
  }

  // ── Chat endpoint ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && parsed.pathname === '/api/chat') {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (!IBM_API_KEY)    throw new Error('IBM_API_KEY not set in .env');
      if (!WML_PROJECT_ID) throw new Error('WML_PROJECT_ID not set in .env');

      const { message, diagramType, structure } = await readBody(req);
      if (!message) throw new Error('message field is required');

      const userPrompt = [
        'DIAGRAM TYPE: ' + (diagramType || 'flowchart').toUpperCase(),
        '\nDESCRIPTION:\n' + message,
        structure ? '\nSTRUCTURE:\n' + structure : ''
      ].join('');

      console.log('[chat] Getting IAM token...');
      const token = await getIAMToken(IBM_API_KEY);

      console.log('[chat] Calling Granite-3 via WML...');
      const result = await callGranite(token, WML_PROJECT_ID, userPrompt);

      res.writeHead(200);
      res.end(JSON.stringify({ code: result }));
    } catch(err) {
      console.error('[/api/chat] ERROR:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║  TikZ AI — watsonx Orchestrate + Granite-3          ║
  ║  http://localhost:${PORT}                              ║
  ╠══════════════════════════════════════════════════════╣
  ║  Model   : ibm/granite-4-h-small                    ║
  ║  WML Host: ${WML_HOST}          ║
  ║  Project : ${(WML_PROJECT_ID || 'NOT SET').slice(0, 36)}
  ║  Agent   : ${(AGENT_ID || 'NOT SET').slice(0, 36)}
  ╚══════════════════════════════════════════════════════╝
  `);
});
