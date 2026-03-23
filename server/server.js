require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { authMiddleware, generateToken } = require('./middleware/auth');
const { router: emailRouter, seedTemplates, startEmailCron } = require('./routes/emails');
const { router: documentsRouter, UPLOAD_ROOT } = require('./routes/documents');
const { router: chatRouter } = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ── CORS restreint ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3001').split(',');
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS non autorisé'));
  },
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes. Ralentissez.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/login', loginLimiter);

app.use(express.json({ limit: '10mb' }));

// ── Static uploads (serve physical files) ────────────────────────────────────
app.use('/uploads', express.static(UPLOAD_ROOT));

// ── Database ──────────────────────────────────────────────────────────────────

const dbPath = path.join(__dirname, 'crm.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Enable WAL mode for better concurrent access
db.run('PRAGMA journal_mode=WAL');

// ── Tables ────────────────────────────────────────────────────────────────────

db.serialize(() => {
  // --- Core tables ---
  db.run(`CREATE TABLE IF NOT EXISTS dossiers (
    id TEXT PRIMARY KEY,
    client TEXT NOT NULL,
    client_org TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    postal_code TEXT,
    dp_number TEXT,
    parcelle TEXT,
    works TEXT,
    status TEXT DEFAULT 'nouveau',
    assignee TEXT,
    created TEXT,
    updated TEXT,
    paid BOOLEAN DEFAULT 0,
    amount REAL DEFAULT 0,
    installed BOOLEAN DEFAULT 0,
    docs TEXT,
    comments TEXT,
    avancement TEXT,
    client_access BOOLEAN DEFAULT 0,
    client_token TEXT
  )`, err => { if (err) console.error('dossiers table:', err); else console.log('✅ dossiers table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    initials TEXT,
    avatar TEXT,
    created TEXT
  )`, err => { if (err) console.error('users table:', err); else console.log('✅ users table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS clients_org (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    siret TEXT,
    representant TEXT,
    email TEXT,
    phone TEXT,
    created TEXT,
    updated TEXT
  )`, err => { if (err) console.error('clients_org table:', err); else console.log('✅ clients_org table OK'); });

  // --- GED tables ---
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_id TEXT,
    client_org_id INTEGER,
    name TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    size INTEGER,
    category TEXT DEFAULT 'autre',
    storage_path TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    parent_id INTEGER,
    uploaded_by TEXT,
    created TEXT,
    updated TEXT,
    FOREIGN KEY(dossier_id) REFERENCES dossiers(id),
    FOREIGN KEY(parent_id) REFERENCES documents(id)
  )`, err => { if (err) console.error('documents table:', err); else console.log('✅ documents table OK'); });

  // --- Email tables ---
  db.run(`CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    variables TEXT DEFAULT '[]',
    created TEXT,
    updated TEXT
  )`, err => { if (err) console.error('email_templates table:', err); else console.log('✅ email_templates table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    dossier_id TEXT,
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT DEFAULT '',
    scheduled_at TEXT,
    sent_at TEXT,
    status TEXT DEFAULT 'pending',
    resend_id TEXT,
    error TEXT,
    created TEXT
  )`, err => { if (err) console.error('email_queue table:', err); else console.log('✅ email_queue table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER,
    dossier_id TEXT,
    to_email TEXT,
    subject TEXT,
    status TEXT,
    resend_id TEXT,
    error TEXT,
    sent_at TEXT
  )`, err => {
    if (err) { console.error('email_log table:', err); return; }
    console.log('✅ email_log table OK');
    // Seed templates after tables are created
    setTimeout(() => seedTemplates(db), 500);
  });

  // --- Chat tables ---
  db.run(`CREATE TABLE IF NOT EXISTS chat_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    dossier_id TEXT,
    type TEXT DEFAULT 'general',
    scope TEXT DEFAULT 'interne',
    created_by INTEGER,
    created TEXT,
    updated TEXT,
    FOREIGN KEY(dossier_id) REFERENCES dossiers(id)
  )`, err => { if (err) console.error('chat_conversations table:', err); else console.log('✅ chat_conversations table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS chat_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    user_id INTEGER,
    joined TEXT,
    FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, err => { if (err) console.error('chat_participants table:', err); else console.log('✅ chat_participants table OK'); });

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    sender_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text',
    audio_data TEXT,
    audio_duration REAL,
    read_by TEXT DEFAULT '[]',
    created TEXT,
    FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
  )`, err => { if (err) console.error('chat_messages table:', err); else console.log('✅ chat_messages table OK'); });

  // ── Migrations : colonnes de suivi DP ──────────────────────────────────────
  // SQLite ignore silencieusement si la colonne existe déjà (IF NOT EXISTS non supporté
  // pour ADD COLUMN avant SQLite 3.37, donc on tente et on absorbe l'erreur)
  const migrations = [
    `ALTER TABLE dossiers ADD COLUMN date_envoi_dp TEXT`,
    `ALTER TABLE dossiers ADD COLUMN mairie_email TEXT`,
    `ALTER TABLE dossiers ADD COLUMN relance_recepisee_at TEXT`,
    `ALTER TABLE dossiers ADD COLUMN relance_accord_dp_at TEXT`,
    // ── KBIS extraction columns ──
    `ALTER TABLE dossiers ADD COLUMN siret TEXT`,
    `ALTER TABLE dossiers ADD COLUMN company_name TEXT`,
    `ALTER TABLE dossiers ADD COLUMN representant TEXT`,
    `ALTER TABLE dossiers ADD COLUMN kbis_address TEXT`,
    // ── Ville + urbanisme AI ──
    `ALTER TABLE dossiers ADD COLUMN ville TEXT`,
    `ALTER TABLE dossiers ADD COLUMN urbanisme_result TEXT`,
    // ── Email queue : expéditeur personnalisé ──
    `ALTER TABLE email_queue ADD COLUMN from_email TEXT`,
    `ALTER TABLE email_queue ADD COLUMN from_name TEXT`,
    // ── Users : config SMTP par utilisateur ──
    `ALTER TABLE users ADD COLUMN smtp_password TEXT`,
    // ── Chat : scope interne/externe ──
    `ALTER TABLE chat_conversations ADD COLUMN scope TEXT DEFAULT 'interne'`,
  ];
  migrations.forEach(sql => {
    db.run(sql, err => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Migration:', err.message);
      }
    });
  });
});

// ── Inject DB into requests ───────────────────────────────────────────────────

app.use((req, _res, next) => { req.db = db; next(); });

// ── Auth middleware — protège toutes les routes /api/* sauf login/health/share ─
app.use(authMiddleware);

// ── Email routes ──────────────────────────────────────────────────────────────

app.use('/api/emails', emailRouter);

// ── Document routes (GED) ─────────────────────────────────────────────────────

app.use('/api/documents', documentsRouter);

// ── Chat routes ─────────────────────────────────────────────────────────────

app.use('/api/chat', chatRouter);

// ── Dossiers ──────────────────────────────────────────────────────────────────

const DOSSIER_COLS = 'id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token,siret,company_name,representant,kbis_address,ville,urbanisme_result';

function parseDossier(row) {
  return {
    ...row,
    works:      JSON.parse(row.works      || '[]'),
    docs:       JSON.parse(row.docs       || '[]'),
    comments:   JSON.parse(row.comments   || '[]'),
    avancement: JSON.parse(row.avancement || '{}'),
    urbanisme_result: JSON.parse(row.urbanisme_result || 'null'),
    paid:       Boolean(row.paid),
    installed:  Boolean(row.installed),
    client_access: Boolean(row.client_access),
  };
}

app.get('/api/dossiers', (req, res) => {
  const { status, assignee, search } = req.query;
  let query = `SELECT ${DOSSIER_COLS} FROM dossiers`;
  const params = [];
  const conditions = [];
  if (status)   { conditions.push('status = ?');                        params.push(status); }
  if (assignee) { conditions.push('assignee = ?');                      params.push(assignee); }
  if (search)   { conditions.push('(client LIKE ? OR email LIKE ? OR dp_number LIKE ?)'); const s = `%${search}%`; params.push(s,s,s); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY updated DESC';
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(parseDossier));
  });
});

app.get('/api/dossiers/:id', (req, res) => {
  db.get(`SELECT ${DOSSIER_COLS} FROM dossiers WHERE id=?`, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Dossier introuvable' });
    res.json(parseDossier(row));
  });
});

app.post('/api/dossiers', (req, res) => {
  const d = req.body;
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO dossiers (id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token,siret,company_name,representant,kbis_address,ville,urbanisme_result)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id, d.client, d.client_org||null, d.email||null, d.phone||null, d.address||null,
     d.postal_code||null, d.dp_number||null, d.parcelle||null,
     JSON.stringify(d.works||[]), d.status||'nouveau', d.assignee||null,
     d.created||now, d.updated||now,
     d.paid?1:0, d.amount||0, d.installed?1:0,
     JSON.stringify(d.docs||[]), JSON.stringify(d.comments||[]), JSON.stringify(d.avancement||{}),
     d.client_access?1:0, d.client_token||null,
     d.siret||null, d.company_name||null, d.representant||null, d.kbis_address||null,
     d.ville||null, d.urbanisme_result?JSON.stringify(d.urbanisme_result):null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: d.id, message: 'Dossier créé' });
    }
  );
});

app.put('/api/dossiers/:id', (req, res) => {
  const d = req.body;
  const now = new Date().toISOString();
  db.run(
    `UPDATE dossiers SET client=?,client_org=?,email=?,phone=?,address=?,postal_code=?,dp_number=?,parcelle=?,works=?,status=?,assignee=?,updated=?,paid=?,amount=?,installed=?,docs=?,comments=?,avancement=?,client_access=?,siret=?,company_name=?,representant=?,kbis_address=?,ville=?,urbanisme_result=? WHERE id=?`,
    [d.client, d.client_org||null, d.email||null, d.phone||null, d.address||null,
     d.postal_code||null, d.dp_number||null, d.parcelle||null,
     JSON.stringify(d.works||[]), d.status, d.assignee||null,
     d.updated||now, d.paid?1:0, d.amount||0, d.installed?1:0,
     JSON.stringify(d.docs||[]), JSON.stringify(d.comments||[]), JSON.stringify(d.avancement||{}),
     d.client_access?1:0, d.siret||null, d.company_name||null, d.representant||null, d.kbis_address||null,
     d.ville||null, d.urbanisme_result?JSON.stringify(d.urbanisme_result):null,
     req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Dossier mis à jour' });
    }
  );
});

app.delete('/api/dossiers/:id', (req, res) => {
  db.run('DELETE FROM dossiers WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dossier supprimé' });
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role, initials, avatar, CASE WHEN smtp_password IS NOT NULL AND smtp_password != \'\' THEN 1 ELSE 0 END as smtp_configured FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  db.get('SELECT * FROM users WHERE email=?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Identifiants invalides' });

    let passwordValid = false;
    if (row.password.startsWith('$2a$') || row.password.startsWith('$2b$')) {
      passwordValid = await bcrypt.compare(password, row.password);
    } else {
      passwordValid = (row.password === password);
      if (passwordValid) {
        const hashed = await bcrypt.hash(password, 12);
        db.run('UPDATE users SET password=? WHERE id=?', [hashed, row.id]);
      }
    }

    if (!passwordValid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = generateToken(row);
    res.json({
      token,
      user: { id: row.id, name: row.name, email: row.email, role: row.role, initials: row.initials, smtp_configured: !!(row.smtp_password) },
    });
  });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role, initials } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nom, email et mot de passe requis' });

  const hashed = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  db.run(
    'INSERT INTO users (name, email, password, role, initials, created) VALUES (?,?,?,?,?,?)',
    [name, email, hashed, role || 'employee', initials || name.slice(0, 2).toUpperCase(), now],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        return res.status(500).json({ error: err.message });
      }
      const user = { id: this.lastID, name, email, role: role || 'employee' };
      const token = generateToken(user);
      res.json({ token, user });
    }
  );
});

// PUT /api/users/:id/smtp — configurer le mot de passe SMTP d'un utilisateur
app.put('/api/users/:id/smtp', (req, res) => {
  const { smtp_password } = req.body;
  db.run('UPDATE users SET smtp_password = ? WHERE id = ?', [smtp_password || null, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ success: true, message: smtp_password ? 'Mot de passe SMTP enregistré' : 'Mot de passe SMTP supprimé' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// URBANISME LOOKUP — Annuaire Service Public + Google Places + Scanner GNAU
// ══════════════════════════════════════════════════════════════════════════════

const ANNUAIRE_BASE = 'https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records';
const ANNUAIRE_FIELDS = 'nom,pivot,adresse_courriel,adresse,plage_ouverture,site_internet,telephone,code_insee_commune,sve,formulaire_contact';

// ── Mots-clés HTML pour détecter une vraie page GNAU/urbanisme ──────────────
const KEYWORDS_HTML = [
  'gnau','guichet numerique des autorisations d urbanisme', 
  "guichet numérique des autorisations d'urbanisme",
  'operis','geosphere','geopermis','e-permis','sve sirap',"ide'au",'ideau',
  "autorisation d urbanisme","autorisation d'urbanisme",'urbanisme',
  'guichet unique','deposer un dossier','déposer un dossier',
  'permis de construire en ligne','demande d autorisation',
  'communaute de communes','communauté de communes',
  "communaute d agglomeration","communauté d'agglomération",
  'metropole','métropole','service urbanisme', 'OpenADS' , 'Next ADS',
  'demarches en ligne urbanisme','teleprocedure urbanisme', 'Cart@DS',
  'téléprocédure urbanisme', 'ingenieriere70', 'sirap', 'atip67', 'oci-urbanisme', 'xdemat', 'xurba', 'ads', 'ideau',
];

// ── Patterns d'URL de plateformes GNAU/urbanisme ────────────────────────────
const GNAU_PATTERNS = [
  // OPERIS (gnau1 à gnau49)
  'https://gnau{n}.operis.fr/{slug}/gnau/#/',
  'https://gnau{n}.operis.fr/{slug}/gnau/',
  // GEOSPHERE / CARTADS
  'https://{slug}.geosphere.fr/guichet-unique',
  'https://{slug}.geosphere.fr/gnau',
  'https://cartads.{slug}.fr/guichet-unique',
  'https://cartads.{slug}.fr/gnau',
  'https://gnau.cartads.fr/{slug}',
  // SIRAP Next’ADS
  'https://portail-usager.sirap.fr/{slug}',
  'https://portail-usager.sirap.com/{slug}',
  'https://portail-usager.sirap.com/recherche-commune',
  'https://sve.sirap.fr',
  // GEO PERMIS / E-PERMIS
  'https://www.geopermis.fr/{slug}',
  'https://www.e-permis.fr/{slug}',
  // ATIP
  'https://appli.atip67.fr/guichet-unique',
  'https://appli.atip67.fr/guichet-unique/Accueil',
  // OCI URBANISME
  'https://saasweb.oci-urbanisme.fr/{slug}',
  // XDEMAT
  'https://www.spl-xdemat.fr/Xurba/gnau/',
  // ADS
  'https://{slug}.ads.{slug}.fr/gnau/#/',
  'https://ads.{slug}.fr/gnau/#/',
  'https://{slug}.ads.fr/gnau/#/',
  // INGENIERIE
  'https://urbanisme.{slug}.fr/gnaud/',
  // DOMAINES DIRECTS
  'https://gnau.{slug}.fr/',
  'https://{slug}.fr/gnau/',
  'https://www.{slug}.fr/gnau/',
  // GENERIC
  'https://{slug}.fr/guichet-unique',
  'https://www.{slug}.fr/guichet-unique',
  'https://{slug}.fr/urbanisme',
  'https://www.{slug}.fr/urbanisme',

];

const EXTRA_PATHS = ['gnau','gnau/#/','guichet-unique','guichet-unique/Accueil','urbanisme','ads','ads/gnau'];

const SPECIAL_URLS = [
  'https://www.e-permis.fr/',
  'https://portail-usager.sirap.com/recherche-commune',
  'https://www.spl-xdemat.fr/Xurba/gnau/',
  'https://www.geopermis.fr/',
  'https://appli.atip67.fr/guichet-unique/Accueil',
];

const GNAU_TIMEOUT = 4000; // 4s par URL
const GNAU_CONCURRENCY = 25; // requêtes parallèles

// ── Utilitaires ─────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Vérifie si le HTML contient assez de mots-clés urbanisme (seuil = 2) */
function isGnauHtml(html) {
  const norm = normalizeText(html);
  let score = 0;
  for (const kw of KEYWORDS_HTML) {
    if (norm.includes(normalizeText(kw))) score++;
  }
  return score >= 2;
}

/** Identifie le type de plateforme depuis l'URL */
function identifyPlatformType(url) {
  const s = url.toLowerCase();
  if (s.includes('operis')) return 'Operis/GNAU';
  if (s.includes('geosphere')) return 'Geosphere';
  if (s.includes('cartads')) return 'Cartads';
  if (s.includes('sirap')) return 'SIRAP';
  if (s.includes('geopermis')) return 'Geopermis';
  if (s.includes('e-permis')) return 'e-Permis';
  if (s.includes('atip')) return 'ATIP';
  if (s.includes('oci-urbanisme')) return 'OCI Urbanisme';
  if (s.includes('xdemat') || s.includes('xurba')) return 'Xdemat/Xurba';
  if (s.includes('ideau') || s.includes("ide'au")) return "iDE'AU";
  if (s.includes('ads.') || s.includes('/ads')) return 'ADS';
  if (s.includes('gnau')) return 'GNAU';
  if (s.includes('guichet-unique') || s.includes('guichet unique')) return 'Guichet Unique';
  if (s.includes('urbanisme')) return 'Portail urbanisme';
  return 'Plateforme urbanisme';
}

// ── Génération de toutes les URLs candidates ────────────────────────────────

function generateUrls(name) {
  const slug = slugify(name);
  const urls = new Set();

  for (const p of GNAU_PATTERNS) {
    if (p.includes('{n}')) {
      for (let n = 1; n <= 49; n++) {
        urls.add(p.replace(/\{n\}/g, n).replace(/\{slug\}/g, slug));
      }
    } else {
      urls.add(p.replace(/\{slug\}/g, slug));
    }
  }

  // Domaines directs + chemins additionnels
  for (const domain of [`${slug}.fr`, `www.${slug}.fr`]) {
    for (const path of EXTRA_PATHS) {
      urls.add(`https://${domain}/${path}`);
      urls.add(`https://${domain}/${path}/`);
    }
  }

  // URLs spéciales connues
  for (const u of SPECIAL_URLS) urls.add(u);

  return [...urls];
}

// ── Vérification URL : alive + contenu GNAU ─────────────────────────────────

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GNAU_TIMEOUT);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 EcoFormalitesCRM/1.0' },
    });
    clearTimeout(timer);
    if (resp.status >= 200 && resp.status < 400) {
      const html = await resp.text();
      if (isGnauHtml(html)) return url;
    }
  } catch { /* timeout, DNS fail, etc. — on ignore */ }
  return null;
}

/**
 * Lance toutes les vérifications d'URL en parallèle avec limite de concurrence.
 * Retourne la liste des URLs qui sont vivantes ET contiennent du contenu urbanisme.
 */
async function scanAllUrls(urls) {
  const results = [];
  // Process in batches for concurrency control
  for (let i = 0; i < urls.length; i += GNAU_CONCURRENCY) {
    const batch = urls.slice(i, i + GNAU_CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(u => checkUrl(u)));
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
    // Early exit si on a déjà trouvé des résultats
    if (results.length >= 3) break;
  }
  return results;
}

// ── Recherche d'intercommunalité via Google Custom Search (fallback) ────────

async function findIntercommunalite(ville) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!apiKey || !cx || apiKey === 'votre_cle_google_api') return null;

  const queries = [
    `communauté de communes ${ville}`,
    `communauté d'agglomération ${ville}`,
    `${ville} métropole`,
  ];

  for (const q of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=5&lr=lang_fr&gl=fr`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const item of (data.items || [])) {
        const text = `${item.title || ''} ${item.snippet || ''}`.toLowerCase();
        if (text.includes('communauté') || text.includes('métropole') || text.includes('agglomération')) {
          return extractIntercoName(text);
        }
      }
    } catch { continue; }
  }
  return null;
}

function extractIntercoName(text) {
  const patterns = [
    /communaut[eé] de communes [a-zA-ZÀ-ÿ\- ]+/i,
    /communaut[eé] d['']agglom[eé]ration [a-zA-ZÀ-ÿ\- ]+/i,
    /[a-zA-ZÀ-ÿ\- ]+ m[eé]tropole/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return null;
}

// ── Recherche complète GNAU : ville → intercommunalité ──────────────────────

async function findGnau(ville, epciName) {
  console.log(`🔍 Scan GNAU pour : ${ville}`);

  // Étape 1 : scanner les URLs de la ville
  const villeUrls = generateUrls(ville);
  console.log(`   → ${villeUrls.length} URLs candidates (ville)`);
  const villeResults = await scanAllUrls(villeUrls);

  if (villeResults.length) {
    return { source: 'ville', urls: villeResults };
  }

  // Étape 2 : tenter avec l'intercommunalité (EPCI)
  const intercoName = epciName || await findIntercommunalite(ville);
  if (!intercoName) {
    console.log('   → Aucune intercommunalité trouvée');
    return { source: null, urls: [] };
  }

  console.log(`   → Intercommunalité : ${intercoName}`);
  const intercoUrls = generateUrls(intercoName);
  console.log(`   → ${intercoUrls.length} URLs candidates (intercommunalité)`);
  const intercoResults = await scanAllUrls(intercoUrls);

  return { source: 'intercommunalité', interco: intercoName, urls: intercoResults };
}

// ── Annuaire Service Public — helpers ────────────────────────────────────────

function safeJsonParse(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function formatAnnuaireRecord(r) {
  const adresses = safeJsonParse(r.adresse) || [];
  const addr = Array.isArray(adresses) ? adresses[0] : adresses;
  const phones = safeJsonParse(r.telephone) || [];
  const sites = safeJsonParse(r.site_internet) || [];
  const horaires = safeJsonParse(r.plage_ouverture) || [];

  const formatHoraires = (list) => {
    if (!Array.isArray(list) || !list.length) return null;
    return list.map(h => {
      const debut = h.nom_jour_debut || '';
      const fin = h.nom_jour_fin || '';
      const plage = debut === fin ? debut : `${debut} → ${fin}`;
      let heures = '';
      if (h.valeur_heure_debut_1) heures += `${h.valeur_heure_debut_1.slice(0,5)}-${(h.valeur_heure_fin_1||'').slice(0,5)}`;
      if (h.valeur_heure_debut_2) heures += ` / ${h.valeur_heure_debut_2.slice(0,5)}-${(h.valeur_heure_fin_2||'').slice(0,5)}`;
      const cmt = h.commentaire ? ` (${h.commentaire})` : '';
      return `${plage} : ${heures}${cmt}`;
    });
  };

  return {
    nom: r.nom || null,
    email: r.adresse_courriel || null,
    telephone: Array.isArray(phones) && phones.length ? phones[0].valeur || null : null,
    adresse_complete: addr ? [addr.complement1, addr.complement2, addr.numero_voie, `${addr.code_postal || ''} ${addr.nom_commune || ''}`].filter(Boolean).join(', ') : null,
    code_postal: addr?.code_postal || null,
    commune: addr?.nom_commune || null,
    code_insee: r.code_insee_commune || null,
    site_internet: Array.isArray(sites) && sites.length ? sites[0].valeur || null : null,
    sve: r.sve || null,
    formulaire_contact: r.formulaire_contact || null,
    plage_ouverture: formatHoraires(horaires),
  };
}

// ── Google Places — mairie (nom, adresse, horaires, tél) ────────────────────

async function searchMairieGoogle(ville, codep) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'votre_cle_google_api') return null;

  try {
    const query = `mairie ${ville}${codep ? ' ' + codep : ''}`;
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours,places.websiteUri,places.googleMapsUri',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'fr', regionCode: 'FR', maxResultCount: 3 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const p = (data.places || [])[0];
    if (!p) return null;

    return {
      nom: p.displayName?.text || null,
      adresse_complete: p.formattedAddress || null,
      telephone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
      site_internet: p.websiteUri || null,
      plage_ouverture: p.regularOpeningHours?.weekdayDescriptions || null,
      google_maps: p.googleMapsUri || null,
    };
  } catch (err) {
    console.error('Google Places error:', err.message);
    return null;
  }
}

// ── Fusion service-public.fr + Google Places ────────────────────────────────

function mergeMairieSources(annuaire, google) {
  if (!annuaire && !google) return null;
  if (!annuaire) return { ...google, email: null, sve: null, formulaire_contact: null, code_insee: null, code_postal: null, commune: null, sources: ['Google Maps'] };
  if (!google) return { ...annuaire, sources: ['service-public.fr'] };

  return {
    ...annuaire,
    nom: annuaire.nom || google.nom,
    telephone: annuaire.telephone || google.telephone,
    adresse_complete: annuaire.adresse_complete || google.adresse_complete,
    site_internet: annuaire.site_internet || google.site_internet,
    plage_ouverture: annuaire.plage_ouverture || google.plage_ouverture,
    google_maps: google.google_maps || null,
    sources: ['service-public.fr', 'Google Maps'],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/urbanisme/lookup', async (req, res) => {
  const { ville, code_postal } = req.body;
  if (!ville) return res.status(400).json({ error: 'Ville requise' });

  try {
    const villeNorm = ville.trim();
    console.log(`\n🏛  Recherche urbanisme : ${villeNorm} ${code_postal || ''}`);

    // ── 1. Annuaire service-public.fr : mairie ──
    let mairieWhere = `pivot LIKE "mairie" AND nom LIKE "${villeNorm}"`;
    if (code_postal) {
      mairieWhere = `pivot LIKE "mairie" AND (nom LIKE "${villeNorm}" OR adresse LIKE "${villeNorm}") AND adresse LIKE "${code_postal}"`;
    }
    const mairieUrl = `${ANNUAIRE_BASE}?limit=5&select=${encodeURIComponent(ANNUAIRE_FIELDS)}&where=${encodeURIComponent(mairieWhere)}`;
    let mairieAnnuaire = null;
    try {
      const mairieRes = await fetch(mairieUrl);
      if (mairieRes.ok) {
        const mairieData = await mairieRes.json();
        let mairies = (mairieData.results || []).map(formatAnnuaireRecord);
        if (code_postal && mairies.length > 1) {
          const exact = mairies.filter(m => m.code_postal && m.code_postal.startsWith(code_postal.slice(0, 2)));
          if (exact.length) mairies = exact;
        }
        mairieAnnuaire = mairies[0] || null;
      }
    } catch {}

    // ── 2. Google Places : mairie (nom, adresse, horaires, tél) ──
    const mairieGoogle = await searchMairieGoogle(villeNorm, code_postal);

    // ── 3. Fusionner ──
    const mairie = mergeMairieSources(mairieAnnuaire, mairieGoogle);

    // ── 4. Annuaire : communauté de communes / EPCI ──
    let epci = null;
    try {
      const epciWhere = `pivot LIKE "epci" AND adresse LIKE "${mairie?.commune || villeNorm}"`;
      const epciUrl = `${ANNUAIRE_BASE}?limit=3&select=${encodeURIComponent(ANNUAIRE_FIELDS)}&where=${encodeURIComponent(epciWhere)}`;
      const epciRes = await fetch(epciUrl);
      if (epciRes.ok) {
        const epciData = await epciRes.json();
        if (epciData.results?.length) epci = formatAnnuaireRecord(epciData.results[0]);
      }
    } catch {}

    // ── 5. SCAN GNAU : brute-force patterns d'URL (ville → intercommunalité) ──
    const gnauResult = await findGnau(villeNorm, epci?.nom);
    const platformUrls = (gnauResult.urls || []).map(u => ({
      lien: u,
      type: identifyPlatformType(u),
      source: gnauResult.source || 'scan',
      interco: gnauResult.interco || null,
    }));

    // ── 6. Résultat final ──
    const result = {
      ville: villeNorm,
      code_postal: code_postal || mairie?.code_postal || null,
      date_recherche: new Date().toISOString(),
      mairie,
      epci,
      plateforme_urbanisme: platformUrls,
      gnau_source: gnauResult.source || null,
      gnau_interco: gnauResult.interco || null,
      email_urbanisme: mairie?.email || null,
      telephone: mairie?.telephone || null,
      sve: mairie?.sve || epci?.sve || null,
      plage_ouverture: mairie?.plage_ouverture || null,
      intercommunalite: epci?.nom || null,
    };

    console.log(`   ✅ Mairie: ${mairie?.nom || 'non trouvée'} | GNAU: ${platformUrls.length} lien(s) | EPCI: ${epci?.nom || 'non trouvé'}`);
    res.json(result);
  } catch (err) {
    console.error('Urbanisme lookup error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la recherche urbanisme' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✅ Eco-formalités API running on http://localhost:${PORT}`);
  console.log(`📝 Database: ${dbPath}\n`);
  startEmailCron(db);
});

module.exports = db;
