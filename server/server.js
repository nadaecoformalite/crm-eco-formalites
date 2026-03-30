require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');
const { authMiddleware, generateToken, requireInternal } = require('./middleware/auth');
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
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:3001,https://localhost:5173,https://localhost:5174,https://localhost:3000,https://localhost:3001').split(',');
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith('.ngrok-free.dev'))) return callback(null, true);
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
    // ── Partenaire : traçabilité créateur ──
    `ALTER TABLE dossiers ADD COLUMN created_by INTEGER`,
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

app.use('/api/emails', requireInternal, emailRouter);

// ── Document routes (GED) ─────────────────────────────────────────────────────

app.use('/api/documents', requireInternal, documentsRouter);

// ── Chat routes ─────────────────────────────────────────────────────────────

app.use('/api/chat', chatRouter);

// ── Dossiers ──────────────────────────────────────────────────────────────────

const DOSSIER_COLS = 'id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token,siret,company_name,representant,kbis_address,ville,urbanisme_result,created_by';

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
  // Partenaires : uniquement leurs dossiers
  if (req.user && req.user.role === 'partenaire') {
    conditions.push('created_by = ?');
    params.push(req.user.id);
  }
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
    if (req.user && req.user.role === 'partenaire' && row.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Accès interdit' });
    }
    res.json(parseDossier(row));
  });
});

app.post('/api/dossiers', (req, res) => {
  const d = req.body;
  const now = new Date().toISOString();
  const createdBy = req.user ? req.user.id : (d.created_by || null);
  db.run(
    `INSERT INTO dossiers (id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token,siret,company_name,representant,kbis_address,ville,urbanisme_result,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id, d.client, d.client_org||null, d.email||null, d.phone||null, d.address||null,
     d.postal_code||null, d.dp_number||null, d.parcelle||null,
     JSON.stringify(d.works||[]), d.status||'nouveau', d.assignee||null,
     d.created||now, d.updated||now,
     d.paid?1:0, d.amount||0, d.installed?1:0,
     JSON.stringify(d.docs||[]), JSON.stringify(d.comments||[]), JSON.stringify(d.avancement||{}),
     d.client_access?1:0, d.client_token||null,
     d.siret||null, d.company_name||null, d.representant||null, d.kbis_address||null,
     d.ville||null, d.urbanisme_result?JSON.stringify(d.urbanisme_result):null,
     createdBy],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: d.id, message: 'Dossier créé' });
    }
  );
});

app.put('/api/dossiers/:id', (req, res) => {
  // Partenaires : vérifier ownership avant update
  if (req.user && req.user.role === 'partenaire') {
    return db.get('SELECT created_by FROM dossiers WHERE id=?', [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.created_by !== req.user.id) return res.status(403).json({ error: 'Accès interdit' });
      doPutDossier(req, res);
    });
  }
  doPutDossier(req, res);
});
function doPutDossier(req, res) {
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
}

app.delete('/api/dossiers/:id', (req, res) => {
  if (req.user && req.user.role === 'partenaire') {
    return res.status(403).json({ error: 'Suppression non autorisée' });
  }
  db.run('DELETE FROM dossiers WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dossier supprimé' });
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.get('/api/users', (req, res) => {
  // Partenaires : ne voir que les utilisateurs internes (pour le chat) + eux-mêmes
  if (req.user && req.user.role === 'partenaire') {
    return db.all('SELECT id, name, initials, avatar, role FROM users WHERE role IN ("admin","superadmin","employee") OR id = ?', [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
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

// ══════════════════════════════════════════════════════════════════════════════
// URBANISME / GNAU — Recherche de plateforme pour toute commune de France
// Stratégie : commune → API Géo (EPCI) → cache EPCI → scan URLs → Google fallback
// ══════════════════════════════════════════════════════════════════════════════

// ── Cache EPCI → GNAU en SQLite ────────────────────────────────────────────
db.run('CREATE TABLE IF NOT EXISTS gnau_cache (epci_code TEXT PRIMARY KEY, epci_nom TEXT, urls TEXT, platform_type TEXT, source TEXT, updated TEXT)', err => {
  if (err) console.error('gnau_cache table:', err);
  else console.log('gnau_cache table OK');
});

// ── Mots-clés HTML pour détecter une vraie page GNAU/urbanisme ──────────────
const KEYWORDS_HTML = [
  'gnau','guichet numerique des autorisations d urbanisme',
  "guichet numérique des autorisations d'urbanisme",
  'operis','geosphere','geopermis','e-permis','sve sirap',"ide'au",'ideau',
  "autorisation d urbanisme","autorisation d'urbanisme",
  'guichet unique','deposer un dossier','déposer un dossier',
  'permis de construire en ligne','demande d autorisation',
  'communaute de communes','communauté de communes',
  "communaute d agglomeration","communauté d'agglomération",
  'metropole','métropole','service urbanisme','openads','next ads',
  'demarches en ligne urbanisme','teleprocedure urbanisme','cart@ds','cartads',
  'téléprocédure urbanisme','ingenieriere70','sirap','atip67','oci-urbanisme',
  'xdemat','xurba','ads','ideau','rxu','aruci','adau',
  'depot en ligne','dépôt en ligne','teleservice urbanisme','téléservice urbanisme',
  'declaration prealable','déclaration préalable','permis de construire',
  'demande prealable','demande préalable',
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
  'https://{slug}.cartads.fr/',
  // SIRAP Next'ADS
  'https://portail-usager.sirap.fr/{slug}',
  'https://portail-usager.sirap.com/{slug}',
  'https://sve.sirap.fr/{slug}',
  // GEO PERMIS / E-PERMIS
  'https://www.geopermis.fr/{slug}',
  'https://www.e-permis.fr/{slug}',
  // ATIP
  'https://appli.atip67.fr/guichet-unique',
  'https://appli.atip67.fr/guichet-unique/Accueil',
  // OCI URBANISME
  'https://saasweb.oci-urbanisme.fr/{slug}',
  // XDEMAT / XURBA
  'https://www.spl-xdemat.fr/Xurba/gnau/',
  'https://{slug}.xurba.fr/',
  'https://xurba.{slug}.fr/',
  // iDE'AU
  'https://{slug}.ideau.fr/',
  'https://ideau.{slug}.fr/',
  // ADS
  'https://{slug}.ads.{slug}.fr/gnau/#/',
  'https://ads.{slug}.fr/gnau/#/',
  'https://{slug}.ads.fr/gnau/#/',
  // INGENIERIE
  'https://urbanisme.{slug}.fr/gnaud/',
  'https://urbanisme.{slug}.fr/',
  // DOMAINES DIRECTS
  'https://gnau.{slug}.fr/',
  'https://{slug}.fr/gnau/',
  'https://www.{slug}.fr/gnau/',
  // GENERIC
  'https://{slug}.fr/guichet-unique',
  'https://www.{slug}.fr/guichet-unique',
  'https://{slug}.fr/urbanisme',
  'https://www.{slug}.fr/urbanisme',
  'https://{slug}.fr/urbanisme/gnau',
  'https://www.{slug}.fr/urbanisme/gnau',
  // DEMARCHES SIMPLIFIEES
  'https://{slug}.fr/demarches',
  'https://www.{slug}.fr/demarches',
  // PORTAILS SPECIFIQUES
  'https://urbanisme.{slug}.fr/gnau/',
  'https://urbanisme.{slug}.fr/gnau/#/',
  'https://gnau.{slug}.fr/gnau/#/',
  'https://sve.{slug}.fr/',
  'https://autorisations-urbanisme.{slug}.fr/',
  'https://ads.{slug}.fr/',
  'https://guichet-unique.{slug}.fr/',
];

const EXTRA_PATHS = ['gnau','gnau/#/','guichet-unique','guichet-unique/Accueil','urbanisme','ads','ads/gnau','urbanisme/gnau','demarches/urbanisme'];

const GNAU_TIMEOUT = 5000;
const GNAU_CONCURRENCY = 30;

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

/**
 * Génère un slug GNAU collé (sans tirets, sans espaces, sans accents, minuscules).
 * Supprime les préfixes CC / Communauté de Communes / CA / etc.
 * Ex: "CC du Pays de l'Or" → "paysdelor"
 *     "CC Grand Pic Saint-Loup" → "grandpicsaintloup"
 */
function gnauSlug(epciName) {
  let name = epciName;
  // Supprimer les préfixes institutionnels + articles qui suivent
  const prefixes = [
    /^communaut[eé]\s+de\s+communes\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+d['']?agglom[eé]ration\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+urbaine\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^m[eé]tropole\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cc\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^ca\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cu\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
  ];
  for (const p of prefixes) {
    const stripped = name.replace(p, '').trim();
    if (stripped && stripped !== name) { name = stripped; break; }
  }
  // Minuscules, sans accents, tout collé (pas de tirets ni espaces)
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Construit l'URL GNAU Operis : https://gnau{n}.operis.fr/{slug}/gnau/#/
 * @param {string} epciName - Nom complet de la Communauté de Communes
 * @param {number} n - Numéro du serveur (défaut: 1)
 * @returns {string} URL finale
 */
function buildGnauOperisUrl(epciName, n = 1) {
  const slug = gnauSlug(epciName);
  return `https://gnau${n}.operis.fr/${slug}/gnau/#/`;
}

/** Extrait le nom court d'un EPCI (sans le préfixe "CC de", "CA de", etc.) */
function epciShortNames(fullName) {
  const names = new Set();
  names.add(fullName);
  // Retirer les préfixes institutionnels
  const prefixes = [
    /^communaut[eé]\s+de\s+communes\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+d['']?agglom[eé]ration\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+urbaine\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^m[eé]tropole\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cc\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^ca\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cu\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
  ];
  for (const p of prefixes) {
    const stripped = fullName.replace(p, '').trim();
    if (stripped && stripped !== fullName) names.add(stripped);
  }
  return [...names];
}

/** Génère les variantes de slug pour un EPCI */
function epciSlugVariants(fullName) {
  const slugs = new Set();
  const shortNames = epciShortNames(fullName);

  for (const name of shortNames) {
    const s = slugify(name);
    slugs.add(s);
    // Préfixes courants
    slugs.add('cc-' + s);
    slugs.add('ca-' + s);
    slugs.add('cu-' + s);
    slugs.add('cdc-' + s);
    slugs.add('agglo-' + s);
  }

  // Slug complet du nom original
  slugs.add(slugify(fullName));

  // Slug collé (sans tirets) pour les plateformes Operis/GNAU
  // Ex: "CC du Pays de l'Or" → "paysdelor"
  slugs.add(gnauSlug(fullName));

  return [...slugs];
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

// ── API Géo : commune → EPCI (gratuit, pas de clé API) ──────────────────────

async function getEpciFromGeoApi(ville, codePostal) {
  try {
    // Essai 1 : par nom + code postal
    let url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(ville)}&fields=nom,code,codeDepartement,codeEpci,epci,codesPostaux&limit=5`;
    if (codePostal) url += `&codePostal=${encodeURIComponent(codePostal)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const communes = await resp.json();

    if (!communes.length && codePostal) {
      // Essai 2 : par code postal seul
      const resp2 = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(codePostal)}&fields=nom,code,codeDepartement,codeEpci,epci,codesPostaux&limit=10`, { signal: AbortSignal.timeout(5000) });
      if (resp2.ok) {
        const byCP = await resp2.json();
        const villeNorm = normalizeText(ville);
        const match = byCP.find(c => normalizeText(c.nom) === villeNorm) || byCP[0];
        if (match) communes.push(match);
      }
    }

    if (!communes.length) return null;

    // Trouver la meilleure correspondance
    const villeNorm = normalizeText(ville);
    const commune = communes.find(c => normalizeText(c.nom) === villeNorm) || communes[0];

    const result = {
      codeInsee: commune.code,
      nomCommune: commune.nom,
      codeDepartement: commune.codeDepartement,
      codeEpci: commune.codeEpci || commune.epci?.code || null,
      nomEpci: commune.epci?.nom || null,
    };

    // Si on a le code EPCI mais pas le nom, chercher le détail
    if (result.codeEpci && !result.nomEpci) {
      try {
        const epciResp = await fetch(`https://geo.api.gouv.fr/epcis/${result.codeEpci}?fields=nom`, { signal: AbortSignal.timeout(3000) });
        if (epciResp.ok) {
          const epciData = await epciResp.json();
          result.nomEpci = epciData.nom;
        }
      } catch {}
    }

    console.log(`   📍 API Géo : ${result.nomCommune} (${result.codeInsee}) → EPCI: ${result.nomEpci || 'inconnu'} (${result.codeEpci || 'n/a'})`);
    return result;
  } catch (err) {
    console.error('   ⚠ API Géo erreur:', err.message);
    return null;
  }
}

// ── Cache EPCI helpers ──────────────────────────────────────────────────────

function getCachedGnau(epciCode) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM gnau_cache WHERE epci_code = ?', [epciCode], (err, row) => {
      if (err || !row) return resolve(null);
      // Cache valide 30 jours
      const age = Date.now() - new Date(row.updated).getTime();
      if (age > 30 * 24 * 60 * 60 * 1000) return resolve(null);
      resolve({
        urls: JSON.parse(row.urls || '[]'),
        platform_type: row.platform_type,
        source: row.source,
        epci_nom: row.epci_nom,
      });
    });
  });
}

function setCachedGnau(epciCode, epciNom, urls, source) {
  const platformType = urls.length ? identifyPlatformType(urls[0]) : null;
  db.run(
    'INSERT OR REPLACE INTO gnau_cache (epci_code, epci_nom, urls, platform_type, source, updated) VALUES (?,?,?,?,?,?)',
    [epciCode, epciNom, JSON.stringify(urls), platformType, source, new Date().toISOString()]
  );
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

  return [...urls];
}

/** Génère les URLs pour un EPCI en testant toutes les variantes de slug */
function generateEpciUrls(epciName) {
  const slugs = epciSlugVariants(epciName);
  const urls = new Set();

  for (const slug of slugs) {
    for (const p of GNAU_PATTERNS) {
      if (p.includes('{n}')) {
        for (let n = 1; n <= 49; n++) {
          urls.add(p.replace(/\{n\}/g, n).replace(/\{slug\}/g, slug));
        }
      } else {
        urls.add(p.replace(/\{slug\}/g, slug));
      }
    }
    for (const domain of [`${slug}.fr`, `www.${slug}.fr`]) {
      for (const path of EXTRA_PATHS) {
        urls.add(`https://${domain}/${path}`);
        urls.add(`https://${domain}/${path}/`);
      }
    }
  }

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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 EcoFormalitesCRM/2.0' },
    });
    clearTimeout(timer);
    if (resp.status >= 200 && resp.status < 400) {
      const html = await resp.text();
      if (isGnauHtml(html)) return { url, finalUrl: resp.url };
    }
  } catch { /* timeout, DNS fail, etc. */ }
  return null;
}

/**
 * Scan toutes les URLs en parallèle avec concurrence limitée.
 * Retourne les URLs vivantes contenant du contenu urbanisme.
 */
async function scanAllUrls(urls) {
  const results = [];
  for (let i = 0; i < urls.length; i += GNAU_CONCURRENCY) {
    const batch = urls.slice(i, i + GNAU_CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(u => checkUrl(u)));
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        const finalUrl = r.value.finalUrl || r.value.url;
        if (!results.includes(finalUrl)) results.push(finalUrl);
      }
    }
    if (results.length >= 3) break;
  }
  return results;
}

// ── Google Search fallback : chercher la plateforme GNAU via Google ────────

/**
 * Recherche Google Custom Search et retourne le 1er lien GNAU/urbanisme trouvé.
 * Vérifie que l'URL pointe bien vers une plateforme urbanisme.
 */
async function googleSearchGnau(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!apiKey || !cx || apiKey === 'votre_cle_google_api') return [];

  try {
    console.log(`   Google : "${query}"`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10&lr=lang_fr&gl=fr`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) { console.log(`   Google HTTP ${resp.status}`); return []; }
    const data = await resp.json();

    const candidateUrls = [];
    for (const item of (data.items || [])) {
      const link = item.link || '';
      // Garder les URLs qui ressemblent à des plateformes GNAU/urbanisme
      if (/gnau|operis|geosphere|cartads|sirap|geopermis|e-permis|xurba|xdemat|ideau|oci-urbanisme|guichet-unique|urbanisme|openads|next-ads|sve\.|adau|aruci/i.test(link)) {
        candidateUrls.push(link);
      }
    }

    if (!candidateUrls.length) {
      console.log('   Google : aucun lien plateforme dans les résultats');
      return [];
    }

    // Vérifier que les URLs sont vivantes et contiennent du contenu urbanisme
    const verified = [];
    const checks = await Promise.allSettled(candidateUrls.map(u => checkUrl(u)));
    for (const r of checks) {
      if (r.status === 'fulfilled' && r.value) {
        verified.push(r.value.finalUrl || r.value.url);
      }
    }

    // Si aucune URL vérifiée, retourner quand même le 1er lien Google (il peut être un SPA non détectable par keywords)
    if (!verified.length && candidateUrls.length) {
      console.log('   Google : URLs non vérifiées par keywords, on garde le 1er résultat Google');
      verified.push(candidateUrls[0]);
    }

    return verified;
  } catch (err) {
    console.error('   Google Search error:', err.message);
    return [];
  }
}

// ── Recherche GNAU : chemin précis ──────────────────────────────────────────
// Étape 1 : gnau "code_postal" "ville"
// Étape 2 : gnau "communauté de communes" "code_postal" "ville"

async function findGnau(ville, epciInfo, codePostal) {
  const epciCode = epciInfo?.codeEpci;
  const epciName = epciInfo?.nomEpci;
  const cp = codePostal || '';

  // ── Cache EPCI : si déjà trouvé, retourner directement ──
  if (epciCode) {
    const cached = await getCachedGnau(epciCode);
    if (cached && cached.urls.length > 0) {
      console.log(`   Cache EPCI hit : ${cached.epci_nom} -> ${cached.urls.length} URL(s)`);
      return { source: 'cache_epci', interco: cached.epci_nom, urls: cached.urls };
    }
  }

  console.log(`\n   Recherche GNAU pour : ${ville} ${cp}`);

  // ── Étape 0 : URL Operis construite directement depuis le nom EPCI (slug collé) ──
  if (epciName) {
    const operisUrl = buildGnauOperisUrl(epciName);
    console.log(`   Test URL Operis construite : ${operisUrl}`);
    const operisCheck = await checkUrl(operisUrl);
    if (operisCheck) {
      console.log(`   TROUVE (étape 0 - Operis construit) : ${operisCheck.finalUrl || operisUrl}`);
      const foundUrls = [operisCheck.finalUrl || operisUrl];
      if (epciCode) setCachedGnau(epciCode, epciName, foundUrls, 'operis_construit');
      return { source: 'operis_construit', interco: epciName, urls: foundUrls };
    }
  }

  // ── Étape 1 : Google → gnau "code_postal" "ville" ──
  const q1 = `gnau ${cp ? '"' + cp + '"' : ''} "${ville}"`;
  const step1 = await googleSearchGnau(q1);

  if (step1.length) {
    console.log(`   TROUVE (étape 1) : ${step1[0]}`);
    if (epciCode) setCachedGnau(epciCode, epciName, step1, 'google_ville');
    return { source: 'google_ville', urls: step1 };
  }

  // ── Étape 2 : Google → gnau "communauté de communes" "code_postal" "ville" ──
  if (epciName) {
    const q2 = `gnau "${epciName}" ${cp ? '"' + cp + '"' : ''} "${ville}"`;
    const step2 = await googleSearchGnau(q2);

    if (step2.length) {
      console.log(`   TROUVE (étape 2 - EPCI) : ${step2[0]}`);
      if (epciCode) setCachedGnau(epciCode, epciName, step2, 'google_epci');
      return { source: 'google_epci', interco: epciName, urls: step2 };
    }

    // ── Étape 2b : essayer juste avec le nom de l'EPCI ──
    const q2b = `gnau "${epciName}"`;
    const step2b = await googleSearchGnau(q2b);

    if (step2b.length) {
      console.log(`   TROUVE (étape 2b - EPCI seul) : ${step2b[0]}`);
      if (epciCode) setCachedGnau(epciCode, epciName, step2b, 'google_epci');
      return { source: 'google_epci', interco: epciName, urls: step2b };
    }
  }

  // ── Rien trouvé ──
  if (epciCode) setCachedGnau(epciCode, epciName, [], 'not_found');
  console.log('   Aucune plateforme trouvée');
  return { source: null, urls: [] };
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
    const resp = await fetch('https://places.googleapis.coRm/v1/places:searchText', {
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

    // ── 1. API Géo : identifier la commune + EPCI (gratuit, fiable, 35k+ communes) ──
    const geoInfo = await getEpciFromGeoApi(villeNorm, code_postal);

    // ── 2. Annuaire service-public.fr : mairie ──
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

    // ── 3. Google Places : mairie (nom, adresse, horaires, tél) ──
    const mairieGoogle = await searchMairieGoogle(villeNorm, code_postal);

    // ── 4. Fusionner ──
    const mairie = mergeMairieSources(mairieAnnuaire, mairieGoogle);

    // ── 5. Annuaire : communauté de communes / EPCI (enrichissement) ──
    let epci = null;
    const epciSearchName = geoInfo?.nomEpci || mairie?.commune || villeNorm;
    try {
      const epciWhere = `pivot LIKE "epci" AND (nom LIKE "${epciSearchName}" OR adresse LIKE "${mairie?.commune || villeNorm}")`;
      const epciUrl = `${ANNUAIRE_BASE}?limit=3&select=${encodeURIComponent(ANNUAIRE_FIELDS)}&where=${encodeURIComponent(epciWhere)}`;
      const epciRes = await fetch(epciUrl);
      if (epciRes.ok) {
        const epciData = await epciRes.json();
        if (epciData.results?.length) epci = formatAnnuaireRecord(epciData.results[0]);
      }
    } catch {}

    // ── 6. GNAU : Google "gnau CP ville" puis "gnau EPCI CP ville" ──
    const gnauResult = await findGnau(villeNorm, {
      codeEpci: geoInfo?.codeEpci,
      nomEpci: geoInfo?.nomEpci || epci?.nom,
      codeDepartement: geoInfo?.codeDepartement,
    }, code_postal);
    const platformUrls = (gnauResult.urls || []).map(u => ({
      lien: u,
      type: identifyPlatformType(u),
      source: gnauResult.source || 'scan',
      interco: gnauResult.interco || geoInfo?.nomEpci || null,
    }));

    // ── 7. Résultat final ──
    const result = {
      ville: geoInfo?.nomCommune || villeNorm,
      code_postal: code_postal || mairie?.code_postal || null,
      code_insee: geoInfo?.codeInsee || mairie?.code_insee || null,
      departement: geoInfo?.codeDepartement || null,
      date_recherche: new Date().toISOString(),
      mairie,
      epci: epci ? { ...epci, code_epci: geoInfo?.codeEpci || null } : geoInfo?.codeEpci ? { nom: geoInfo.nomEpci, code_epci: geoInfo.codeEpci } : null,
      plateforme_urbanisme: platformUrls,
      gnau_source: gnauResult.source || null,
      gnau_interco: gnauResult.interco || geoInfo?.nomEpci || null,
      email_urbanisme: mairie?.email || null,
      telephone: mairie?.telephone || null,
      sve: mairie?.sve || epci?.sve || null,
      plage_ouverture: mairie?.plage_ouverture || null,
      intercommunalite: geoInfo?.nomEpci || epci?.nom || null,
    };

    console.log(`   ✅ Mairie: ${mairie?.nom || 'non trouvée'} | EPCI: ${geoInfo?.nomEpci || epci?.nom || 'non trouvé'} (${geoInfo?.codeEpci || 'n/a'}) | GNAU: ${platformUrls.length} lien(s) [${gnauResult.source || 'aucun'}]`);
    res.json(result);
  } catch (err) {
    console.error('Urbanisme lookup error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la recherche urbanisme' });
  }
});

// ── Proxy CERFA officiel (cache local) ────────────────────────────────────────
const CERFA_CACHE_PATH = path.join(__dirname, 'cerfa_16702.pdf');
const CERFA_OFFICIAL_URL = 'https://www.formulaires.service-public.gouv.fr/gf/cerfa_16702.do';

function downloadCerfaFromGouv() {
  return new Promise((resolve, reject) => {
    const doRequest = (url, redirects) => {
      if (redirects > 5) return reject(new Error('Trop de redirections'));
      const mod = url.startsWith('https') ? https : require('http');
      mod.get(url, { headers: { 'User-Agent': 'EcoFormalites-CRM/1.0' }, timeout: 15000 }, (resp) => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          return doRequest(resp.headers.location, redirects + 1);
        }
        if (resp.statusCode !== 200) return reject(new Error('Status ' + resp.statusCode));
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => resolve(Buffer.concat(chunks)));
        resp.on('error', reject);
      }).on('error', reject);
    };
    doRequest(CERFA_OFFICIAL_URL, 0);
  });
}

app.get('/api/cerfa-pdf', async (_req, res) => {
  try {
    // Servir depuis le cache si le fichier existe et a moins de 30 jours
    if (fs.existsSync(CERFA_CACHE_PATH)) {
      const stat = fs.statSync(CERFA_CACHE_PATH);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 30 * 24 * 60 * 60 * 1000 && stat.size > 10000) {
        console.log('📄 CERFA servi depuis cache local (age:', Math.round(ageMs/86400000), 'jours, taille:', stat.size, ')');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Cerfa-Source', 'cache');
        return fs.createReadStream(CERFA_CACHE_PATH).pipe(res);
      }
    }
    // Télécharger depuis service-public.gouv.fr
    console.log('📄 CERFA → Téléchargement depuis', CERFA_OFFICIAL_URL);
    const buffer = await downloadCerfaFromGouv();
    if (buffer.length < 10000) throw new Error('PDF reçu trop petit (' + buffer.length + ' bytes), probablement une page HTML erreur');
    // Vérifier que c'est bien un PDF (signature %PDF)
    if (buffer.slice(0, 5).toString() !== '%PDF-') throw new Error('Le fichier reçu n\'est pas un PDF valide');
    // Sauvegarder en cache
    fs.writeFileSync(CERFA_CACHE_PATH, buffer);
    console.log('✅ CERFA 16702*02 téléchargé et mis en cache (' + buffer.length + ' bytes)');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Cerfa-Source', CERFA_OFFICIAL_URL);
    res.send(buffer);
  } catch (err) {
    console.error('❌ Erreur proxy CERFA:', err.message);
    res.status(502).json({ error: 'Impossible de récupérer le CERFA officiel depuis service-public.gouv.fr', detail: err.message });
  }
});

// ── Forcer la mise à jour du CERFA (supprime le cache et re-télécharge) ──────
app.post('/api/cerfa-refresh', async (_req, res) => {
  try {
    if (fs.existsSync(CERFA_CACHE_PATH)) fs.unlinkSync(CERFA_CACHE_PATH);
    const buffer = await downloadCerfaFromGouv();
    if (buffer.length < 10000) throw new Error('PDF reçu trop petit');
    fs.writeFileSync(CERFA_CACHE_PATH, buffer);
    res.json({ success: true, size: buffer.length, source: CERFA_OFFICIAL_URL });
  } catch (err) {
    console.error('Erreur refresh CERFA:', err.message);
    res.status(502).json({ error: 'Impossible de rafraîchir le CERFA', detail: err.message });
  }
});

// ── Tampon signature Eco Formalites (image PNG) ──────────────────────────────
const STAMP_PATH = path.join(__dirname, 'tampon.png');
app.get('/api/cerfa-stamp', (_req, res) => {
  if (fs.existsSync(STAMP_PATH)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(STAMP_PATH).pipe(res);
  }
  res.status(404).json({ error: 'Tampon non trouvé. Placez tampon.png dans server/' });
});

// ── Sauvegarde/Chargement des CERFA modifiés par dossier ─────────────────────
const CERFA_SAVE_DIR = path.join(__dirname, 'uploads', 'cerfa');
if (!fs.existsSync(CERFA_SAVE_DIR)) fs.mkdirSync(CERFA_SAVE_DIR, { recursive: true });

app.post('/api/cerfa-save/:dossierId', express.raw({ type: 'application/pdf', limit: '20mb' }), (req, res) => {
  const id = req.params.dossierId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return res.status(400).json({ error: 'ID dossier invalide' });
  const filePath = path.join(CERFA_SAVE_DIR, id + '.pdf');
  fs.writeFileSync(filePath, req.body);
  console.log('💾 CERFA sauvegardé pour dossier', id, '(' + req.body.length + ' bytes)');
  res.json({ success: true, size: req.body.length });
});

app.get('/api/cerfa-save/:dossierId', (req, res) => {
  const id = req.params.dossierId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(CERFA_SAVE_DIR, id + '.pdf');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    return fs.createReadStream(filePath).pipe(res);
  }
  res.status(404).json({ error: 'Aucun CERFA sauvegardé pour ce dossier' });
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve frontend (production build) ────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

const SSL_KEY = process.env.SSL_KEY || path.join(__dirname, 'ssl', 'key.pem');
const SSL_CERT = process.env.SSL_CERT || path.join(__dirname, 'ssl', 'cert.pem');

if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`\n🔒 Eco-formalités API running on https://localhost:${PORT}`);
    console.log(`📝 Database: ${dbPath}\n`);
    startEmailCron(db);
  });
} else {
  app.listen(PORT, () => {
    console.log(`\n✅ Eco-formalités API running on http://localhost:${PORT}`);
    console.log(`📝 Database: ${dbPath}\n`);
    startEmailCron(db);
  });
}

module.exports = db;
