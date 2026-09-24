const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SESSION_TTL = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const ALLOWED_ORIGIN = String(process.env.ALLOWED_ORIGIN || '').trim().replace(/\/$/, '');
const AUTH_SECRET = String(process.env.AUTH_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
);
const AI_RATE_WINDOW = 60000;
const AI_RATE_MAX = Number(process.env.AI_RATE_MAX || 30);
const rate = new Map();

const users = new Map();
const sessions = new Map();
const DB_FILE = path.join(ROOT, 'juriscope-data.json');
const CASE_BASE_FILE = path.join(ROOT, 'cases-base.json');
const AREA_BASE_FILE = path.join(ROOT, 'areas-base.json');
const ADMIN_CASE_FILE = path.join(ROOT, 'juriscope-admin-cases.json');
const CASE_BLOB_PATH = 'juriscope/cases.json';

let db = { users: {}, profiles: {}, leaderboard: [] };
let adminCasesCache = null;
try {
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) {}
function persist() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) {}
}

function hashLegacy(p) { return crypto.createHash('sha256').update(String(p)).digest('hex'); }
function secureHash(p) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `s2$${salt}$${crypto.scryptSync(String(p), Buffer.from(salt, 'hex'), 32).toString('hex')}`;
}
function verifyPassword(p, stored) {
  if (String(stored).startsWith('s2$')) {
    const [, salt, hash] = String(stored).split('$');
    try {
      const got = crypto.scryptSync(String(p), Buffer.from(salt, 'hex'), 32).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(hash, 'hex'));
    } catch (e) { return false; }
  }
  return stored === hashLegacy(p);
}
function b64(v) { return Buffer.from(v).toString('base64url'); }
function signToken(user) {
  const payload = { u: user, exp: Date.now() + SESSION_TTL };
  const raw = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('base64url');
  return raw + '.' + sig;
}
function verifyToken(t) {
  try {
    const [raw, sig] = String(t || '').split('.');
    if (!raw || !sig) return null;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!p?.u || Number(p.exp) < Date.now()) return null;
    return withRole(p.u);
  } catch (e) { return null; }
}
function isAdminEmail(email) { return ADMIN_EMAILS.has(String(email || '').trim().toLowerCase()); }
function withRole(user) { return user ? { ...user, role: isAdminEmail(user.email) ? 'admin' : 'user' } : user; }
function authUser(req) {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  return verifyToken(t);
}
function requireAdmin(req) { const u = authUser(req); return u && u.role === 'admin' ? u : null; }
function profileFor(u) {
  if (!u) return null;
  if (!db.profiles[u.id]) db.profiles[u.id] = { study: null, gamification: null, favorites: [], aiHistory: [], updatedAt: null };
  return db.profiles[u.id];
}
for (const [email, rec] of Object.entries(db.users || {})) users.set(email, rec);

function headers(origin = '', secure = false) {
  const h = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(),microphone=(),geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Vary': 'Origin'
  };
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
  if (secure) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}
function json(res, status, body, origin, secure = false) {
  res.writeHead(status, headers(origin, secure));
  res.end(JSON.stringify(body));
}
function body(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let s = '', n = 0;
    req.on('data', c => {
      n += c.length;
      if (n > limit) { reject(new Error('Request too large')); req.destroy(); return; }
      s += c;
    });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}
function limited(ip) {
  const now = Date.now();
  const r = rate.get(ip) || { start: now, count: 0 };
  if (now - r.start > AI_RATE_WINDOW) { r.start = now; r.count = 0; }
  r.count++; rate.set(ip, r);
  return r.count > AI_RATE_MAX;
}

function readJsonFile(file, fallback) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return fallback;
}
const BASE_CASES = readJsonFile(CASE_BASE_FILE, []);
const BASE_AREAS = readJsonFile(AREA_BASE_FILE, {});

function cleanCase(c) {
  const x = c && typeof c === 'object' ? c : {};
  return {
    area: String(x.area || '').trim().slice(0, 120),
    title: String(x.title || '').trim().slice(0, 240),
    yearcourt: String(x.yearcourt || '').trim().slice(0, 180),
    level: ['Beginner', 'Intermediate', 'Advanced'].includes(x.level) ? x.level : 'Intermediate',
    theme: String(x.theme || '').trim().slice(0, 500),
    facts: String(x.facts || '').trim().slice(0, 6000),
    question: String(x.question || '').trim().slice(0, 4000),
    decision: String(x.decision || '').trim().slice(0, 6000),
    why: String(x.why || '').trim().slice(0, 4000),
    source: String(x.source || '').trim().slice(0, 1000),
    country: String(x.country || '').trim().slice(0, 160)
  };
}
function cleanCaseList(list) {
  const out = [], seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const c = cleanCase(raw);
    if (!c.title || !c.area) continue;
    const key = c.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}
async function blobModule() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) return null;
  try { return await import('@vercel/blob'); } catch (e) { return null; }
}
async function loadCaseStore() {
  if (adminCasesCache) return adminCasesCache;
  const bm = await blobModule();
  if (bm) {
    try {
      const got = await bm.get(CASE_BLOB_PATH, { access: 'private', useCache: false });
      if (got?.stream) {
        const txt = await new Response(got.stream).text();
        const parsed = cleanCaseList(JSON.parse(txt));
        if (parsed.length) { adminCasesCache = parsed; return parsed; }
      }
    } catch (e) {}
  }
  const local = cleanCaseList(readJsonFile(ADMIN_CASE_FILE, []));
  adminCasesCache = local.length ? local : cleanCaseList(BASE_CASES);
  return adminCasesCache;
}
async function saveCaseStore(list) {
  const clean = cleanCaseList(list);
  const bm = await blobModule();
  if (bm) {
    await bm.put(CASE_BLOB_PATH, JSON.stringify(clean), {
      access: 'private', allowOverwrite: true, contentType: 'application/json'
    });
    adminCasesCache = clean;
    return clean;
  }
  if (process.env.VERCEL) throw new Error('DURABLE_STORAGE_NOT_CONFIGURED');
  fs.writeFileSync(ADMIN_CASE_FILE, JSON.stringify(clean, null, 2));
  adminCasesCache = clean;
  return clean;
}
function areaObjectFromCases(cases) {
  const out = JSON.parse(JSON.stringify(BASE_AREAS || {}));
  for (const key of Object.keys(out)) out[key].cases = [];
  for (const c of cases) {
    if (!out[c.area]) out[c.area] = {
      num: String(Object.keys(out).length + 1).padStart(2, '0'), count: '0', court: 'Courts',
      intro: 'Cases and legal materials in this legal area.', cases: []
    };
    const tuple = [c.title, c.yearcourt, c.level, c.theme, c.facts, c.question, c.decision, c.why, c.source];
    if (c.country) tuple.push(c.country);
    out[c.area].cases.push(tuple);
  }
  for (const key of Object.keys(out)) out[key].count = String(out[key].cases.length);
  return out;
}
function safeScriptJson(v) {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function injectCasesIntoHtml(file, html, cases) {
  if (file === '/index.html') {
    const marker = 'const CASE_INDEX=window.CASE_INDEX=';
    const st = html.indexOf(marker);
    const en = html.indexOf(';\nfunction renderCaseOfWeek', st);
    if (st >= 0 && en > st) return html.slice(0, st) + marker + safeScriptJson(cases) + html.slice(en);
  }
  if (file === '/area.html') {
    const marker = 'const areas=';
    const st = html.indexOf(marker);
    const en = html.indexOf(';\nconst localized=', st);
    if (st >= 0 && en > st) return html.slice(0, st) + marker + safeScriptJson(areaObjectFromCases(cases)) + html.slice(en);
  }
  return html;
}

async function ai(message, context) {
  const url = process.env.AI_API_URL, key = process.env.AI_API_KEY, model = process.env.AI_MODEL;
  if (!url || !key || !model) {
    const c = context || {}, title = c.title || 'this case';
    const facts = c.facts || 'No case facts were supplied in the archive context.';
    const question = c.question || 'No legal question was supplied in the archive context.';
    const decision = c.decision || 'No decision was supplied in the archive context.';
    const why = c.why || 'No reasoning summary was supplied in the archive context.';
    const theme = c.theme || c.themes || 'No doctrine/theme was supplied.';
    const m = String(message || '').toLowerCase(); let answer;
    if (m.includes('5-year') || m.includes('5 year') || m.includes('simple')) answer = `${title}, very simply: ${facts}\n\nThe legal question was: ${question}\n\nThe court decided: ${decision}`;
    else if (m.includes('why') || m.includes('decision')) answer = `Why the decision in ${title}:\n\n${decision}\n\nReasoning in the archive: ${why}`;
    else if (m.includes('counterargument')) answer = `A useful counterargument to test is whether the court's stated rule should apply differently to the facts.\n\nCase context: ${facts}\n\nLegal question: ${question}`;
    else if (m.includes('doctrine') || m.includes('principle')) answer = `Key doctrine for ${title}: ${theme}\n\nRemember the distinction between the legal rule, its application to the facts, and the court's final outcome.`;
    else if (m.includes('compare')) answer = `For comparison, focus on cases involving the same legal theme (${theme}), then compare facts, legal question, court, reasoning, and outcome.`;
    else answer = `${title}\n\nFacts: ${facts}\n\nLegal question: ${question}\n\nDecision: ${decision}\n\nWhy it matters: ${why}\n\nKey theme: ${theme}`;
    return { answer, demo: true };
  }
  const system = `You are Juriscope AI, an educational legal-study assistant. Use only the supplied Juriscope archive context for case-specific claims. Distinguish court decisions from explanation and do not present educational information as legal advice. Context: ${JSON.stringify(context || {})}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, input: [{ role: 'system', content: system }, { role: 'user', content: String(message || '') }] })
  });
  if (!r.ok) throw new Error(`AI provider returned ${r.status}`);
  const d = await r.json();
  return { answer: d.output_text || d.answer || d.choices?.[0]?.message?.content || 'The AI provider returned no readable answer.' };
}

const handler = async (req, res) => {
  const origin = String(req.headers.origin || '');
  const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
  if (req.method === 'OPTIONS') { res.writeHead(204, headers(origin, secure)); return res.end(); }
  try {
    const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim();

    if (req.method === 'POST' && req.url === '/api/auth/register') {
      const b = await body(req, 1024 * 1024), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json(res, 400, { error: 'Use a valid email and a password of at least 8 characters.' }, origin, secure);
      if (users.has(email)) return json(res, 409, { error: 'Account already exists.' }, origin, secure);
      const user = withRole({ id: crypto.randomUUID(), name: String(b.name || 'Juriscope Student').trim().slice(0, 80), email });
      const rec = { user: { id: user.id, name: user.name, email: user.email }, password: secureHash(password) };
      users.set(email, rec); db.users[email] = rec; persist();
      return json(res, 200, { user, token: signToken(user) }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/auth/login') {
      const b = await body(req, 1024 * 1024), email = String(b.email || '').trim().toLowerCase(), u = users.get(email);
      if (!u || !verifyPassword(b.password, u.password)) return json(res, 401, { error: 'Invalid credentials.' }, origin, secure);
      if (!String(u.password).startsWith('s2$')) { u.password = secureHash(b.password); db.users[email] = u; persist(); }
      const loggedUser = withRole(u.user);
      return json(res, 200, { user: loggedUser, token: signToken(loggedUser) }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/sync') {
      const u = authUser(req); if (!u) return json(res, 401, { error: 'Authentication required.' }, origin, secure);
      const b = await body(req), p = profileFor(u);
      p.study = b.study || p.study; p.gamification = b.gamification || p.gamification;
      p.favorites = Array.isArray(b.favorites) ? b.favorites : p.favorites;
      p.aiHistory = Array.isArray(b.aiHistory) ? b.aiHistory.slice(0, 50) : p.aiHistory; p.updatedAt = new Date().toISOString(); persist();
      return json(res, 200, { ok: true, profile: p }, origin, secure);
    }
    if (req.method === 'GET' && req.url === '/api/sync') {
      const u = authUser(req); if (!u) return json(res, 401, { error: 'Authentication required.' }, origin, secure);
      return json(res, 200, { profile: profileFor(u) }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/leaderboard') {
      const u = authUser(req); if (!u) return json(res, 401, { error: 'Authentication required.' }, origin, secure);
      const b = await body(req), xp = Math.max(0, Number(b.xp || 0)), sessionsN = Math.max(0, Number(b.sessions || 0));
      const arr = Array.isArray(db.leaderboard) ? db.leaderboard : [];
      const row = { id: u.id, name: u.name || 'Juriscope Student', xp, sessions: sessionsN, updatedAt: new Date().toISOString() };
      const i = arr.findIndex(x => x.id === u.id); if (i >= 0) arr[i] = row; else arr.push(row); db.leaderboard = arr; persist();
      return json(res, 200, { ok: true }, origin, secure);
    }

    if (req.method === 'GET' && req.url === '/api/cases') {
      return json(res, 200, { cases: await loadCaseStore() }, origin, secure);
    }
    if (req.method === 'GET' && req.url === '/api/admin/cases') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      const cases = await loadCaseStore();
      return json(res, 200, { cases, count: cases.length, storage: process.env.VERCEL ? 'vercel-blob' : 'local' }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/admin/cases/save') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      const b = await body(req), c = cleanCase(b.case || {});
      if (!c.title || !c.area || !c.yearcourt || !c.facts || !c.question || !c.decision) return json(res, 400, { error: 'Title, area, year/court, facts, legal question and decision are required.' }, origin, secure);
      let cases = await loadCaseStore();
      const original = String(b.originalTitle || c.title).trim().toLowerCase();
      const idx = cases.findIndex(x => x.title.toLowerCase() === original);
      if (idx >= 0) cases[idx] = c; else cases.push(c);
      try { cases = await saveCaseStore(cases); }
      catch (e) { if (e.message === 'DURABLE_STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Durable storage is not configured. Connect a Vercel Blob store to this project first.' }, origin, secure); throw e; }
      return json(res, 200, { ok: true, case: c, count: cases.length }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/admin/cases/delete') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      const b = await body(req), title = String(b.title || '').trim().toLowerCase();
      if (!title) return json(res, 400, { error: 'Case title is required.' }, origin, secure);
      let cases = (await loadCaseStore()).filter(x => x.title.toLowerCase() !== title);
      try { cases = await saveCaseStore(cases); }
      catch (e) { if (e.message === 'DURABLE_STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Durable storage is not configured. Connect a Vercel Blob store to this project first.' }, origin, secure); throw e; }
      return json(res, 200, { ok: true, count: cases.length }, origin, secure);
    }
    if (req.method === 'POST' && req.url === '/api/admin/cases/import') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      const b = await body(req, 5 * 1024 * 1024), incoming = Array.isArray(b.cases) ? b.cases : (Array.isArray(b.data) ? b.data : []);
      if (!incoming.length) return json(res, 400, { error: 'No cases found in the import.' }, origin, secure);
      const map = new Map((await loadCaseStore()).map(c => [c.title.toLowerCase(), c]));
      for (const raw of incoming) { const c = cleanCase(raw); if (c.title && c.area) map.set(c.title.toLowerCase(), c); }
      let cases = [...map.values()];
      try { cases = await saveCaseStore(cases); }
      catch (e) { if (e.message === 'DURABLE_STORAGE_NOT_CONFIGURED') return json(res, 503, { error: 'Durable storage is not configured. Connect a Vercel Blob store to this project first.' }, origin, secure); throw e; }
      return json(res, 200, { ok: true, count: cases.length, imported: incoming.length }, origin, secure);
    }

    if (req.method === 'GET' && req.url === '/api/admin/me') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      return json(res, 200, { user: u, stats: { users: Object.keys(db.users || {}).length, profiles: Object.keys(db.profiles || {}).length, leaderboard: (db.leaderboard || []).length } }, origin, secure);
    }
    if (req.method === 'GET' && req.url === '/api/admin/users') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      const list = Object.values(db.users || {}).map(r => ({ id: r.user?.id, name: r.user?.name, email: r.user?.email, role: isAdminEmail(r.user?.email) ? 'admin' : 'user' }));
      return json(res, 200, { users: list }, origin, secure);
    }
    if (req.method === 'GET' && req.url === '/api/admin/leaderboard') {
      const u = requireAdmin(req); if (!u) return json(res, 403, { error: 'Admin access required.' }, origin, secure);
      return json(res, 200, { leaderboard: (db.leaderboard || []).slice().sort((a, b) => Number(b.xp) - Number(a.xp)) }, origin, secure);
    }
    if (req.method === 'GET' && req.url === '/api/leaderboard') return json(res, 200, { leaderboard: (db.leaderboard || []).slice().sort((a, b) => Number(b.xp) - Number(a.xp)).slice(0, 10) }, origin, secure);
    if (req.method === 'POST' && req.url === '/api/ai') {
      if (limited(ip)) return json(res, 429, { error: 'Too many AI requests. Please try again shortly.' }, origin, secure);
      const b = await body(req, 1024 * 1024); return json(res, 200, await ai(b.message, b.context), origin, secure);
    }

    const file = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const full = path.resolve(ROOT, '.' + file);
    if (!full.startsWith(path.resolve(ROOT) + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return json(res, 404, { error: 'Not found' }, origin, secure);
    const ext = path.extname(full);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    if (ext === '.html' && (file === '/index.html' || file === '/area.html')) {
      const html = fs.readFileSync(full, 'utf8');
      const cases = await loadCaseStore();
      const rendered = injectCasesIntoHtml(file, html, cases);
      res.writeHead(200, { 'Content-Type': types[ext], 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store' });
      return res.end(rendered);
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Server error' }, origin, secure);
  }
};

module.exports = handler;
if (require.main === module) http.createServer(handler).listen(PORT, () => console.log(`Juriscope running at http://localhost:${PORT}`));
