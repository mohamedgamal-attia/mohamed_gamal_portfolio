import http from 'node:http';
import { handleEstimate } from '/home/user/mohamed_gamal_portfolio/backend/supabase/functions/_shared/handler.js';
import crypto from 'node:crypto';

// A stand-in for the deployed stack: the REAL handler, with the three side
// effects faked. Proves the wiring and the verifier, not the providers.
const leads = [];
const deps = {
  db: {
    insertLead: async (r) => { const row = { id: crypto.randomUUID(), ...r }; leads.push(row); return row; },
    updateLead: async (id, patch) => { Object.assign(leads.find(l => l.id === id) || {}, patch); },
  },
  callGemini: async ({ user }) => ({
    model: 'gemini-2.5-flash',
    text: JSON.stringify({
      language: /Preferred language: ar/.test(user) ? 'ar' : 'en',
      project_type: 'erp_business_system',
      summary: 'An ERP covering accounting, CRM and an integrated storefront.',
      recommended_scope: ['Accounting and CRM core', 'E-commerce and website integration', 'Reports and hand-over'],
      price_min_usd: 1200, price_max_usd: 3200,
      estimated_timeline: '10-14 weeks',
      assumptions: ['Scope agreed in a requirements meeting first'],
      customer_message: 'Thanks for the detail. Here is a preliminary range for an ERP of this shape.',
      meeting_cta: 'Book a short call on WhatsApp',
    }),
  }),
  sendEmail: async () => {},
  verifyBot: async () => true,
  rateLimit: async () => true,
  randomBytes: (n) => crypto.randomBytes(n),
  now: () => new Date(),
  log: () => {},
  config: { siteUrl: 'https://example.test', adminUrl: 'https://example.test/admin.html', botCheckRequired: false },
};

const ORIGIN = 'https://mohamedgamal-attia.github.io';
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type, authorization',
               'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  // PostgREST stand-in: RLS gives an anonymous caller an empty set.
  if (req.url.startsWith('/rest/v1/portfolio_leads')) {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end('[]');
  }

  // Gateway: reject an unsigned call exactly as Supabase would.
  if (!req.headers.authorization) {
    res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Missing authorization header' }));
  }

  let raw = ''; for await (const c of req) raw += c;
  let body = null; try { body = JSON.parse(raw); } catch {}
  const out = await handleEstimate(
    { body, headers: {}, ip: '203.0.113.9', rawBodyBytes: Buffer.byteLength(raw) }, deps);
  res.writeHead(out.status, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(out.body));
}).listen(8799, '127.0.0.1', () => console.log('mock backend on :8799'));
