require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { router: emailRouter, seedTemplates, startEmailCron } = require('./routes/emails');
const { router: documentsRouter, UPLOAD_ROOT } = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

  // ── Migrations : colonnes de suivi DP ──────────────────────────────────────
  // SQLite ignore silencieusement si la colonne existe déjà (IF NOT EXISTS non supporté
  // pour ADD COLUMN avant SQLite 3.37, donc on tente et on absorbe l'erreur)
  const migrations = [
    `ALTER TABLE dossiers ADD COLUMN date_envoi_dp TEXT`,
    `ALTER TABLE dossiers ADD COLUMN mairie_email TEXT`,
    `ALTER TABLE dossiers ADD COLUMN relance_recepisee_at TEXT`,
    `ALTER TABLE dossiers ADD COLUMN relance_accord_dp_at TEXT`,
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

// ── Email routes ──────────────────────────────────────────────────────────────

app.use('/api/emails', emailRouter);

// ── Document routes (GED) ─────────────────────────────────────────────────────

app.use('/api/documents', documentsRouter);

// ── Dossiers ──────────────────────────────────────────────────────────────────

const DOSSIER_COLS = 'id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token';

function parseDossier(row) {
  return {
    ...row,
    works:      JSON.parse(row.works      || '[]'),
    docs:       JSON.parse(row.docs       || '[]'),
    comments:   JSON.parse(row.comments   || '[]'),
    avancement: JSON.parse(row.avancement || '{}'),
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
    `INSERT INTO dossiers (id,client,client_org,email,phone,address,postal_code,dp_number,parcelle,works,status,assignee,created,updated,paid,amount,installed,docs,comments,avancement,client_access,client_token)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [d.id, d.client, d.client_org||null, d.email||null, d.phone||null, d.address||null,
     d.postal_code||null, d.dp_number||null, d.parcelle||null,
     JSON.stringify(d.works||[]), d.status||'nouveau', d.assignee||null,
     d.created||now, d.updated||now,
     d.paid?1:0, d.amount||0, d.installed?1:0,
     JSON.stringify(d.docs||[]), JSON.stringify(d.comments||[]), JSON.stringify(d.avancement||{}),
     d.client_access?1:0, d.client_token||null],
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
    `UPDATE dossiers SET client=?,client_org=?,email=?,phone=?,address=?,postal_code=?,dp_number=?,parcelle=?,works=?,status=?,assignee=?,updated=?,paid=?,amount=?,installed=?,docs=?,comments=?,avancement=?,client_access=? WHERE id=?`,
    [d.client, d.client_org||null, d.email||null, d.phone||null, d.address||null,
     d.postal_code||null, d.dp_number||null, d.parcelle||null,
     JSON.stringify(d.works||[]), d.status, d.assignee||null,
     d.updated||now, d.paid?1:0, d.amount||0, d.installed?1:0,
     JSON.stringify(d.docs||[]), JSON.stringify(d.comments||[]), JSON.stringify(d.avancement||{}),
     d.client_access?1:0, req.params.id],
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
  db.all('SELECT id, name, email, role, initials, avatar FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  // NOTE: In production, replace plain-text comparison with bcrypt.compare()
  db.get('SELECT * FROM users WHERE email=? AND password=?', [email, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Identifiants invalides' });
    res.json({ id: row.id, name: row.name, email: row.email, role: row.role, initials: row.initials });
  });
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
