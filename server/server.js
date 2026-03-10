const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = path.join(__dirname, 'crm.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS dossiers (
    id TEXT PRIMARY KEY,
    client TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    dp_number TEXT,
    works TEXT,
    status TEXT DEFAULT 'nouveau',
    assignee TEXT,
    created TEXT,
    updated TEXT,
    paid BOOLEAN DEFAULT 0,
    amount REAL DEFAULT 0,
    docs TEXT,
    notes TEXT,
    client_access BOOLEAN DEFAULT 0,
    client_token TEXT
  )`, (err) => {
    if (err) console.error('Create table error:', err);
    else console.log('Dossiers table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    initials TEXT
  )`, (err) => {
    if (err) console.error('Create users table error:', err);
    else console.log('Users table ready');
  });
});

// ========== DOSSIERS ENDPOINTS ==========

// GET all dossiers
app.get('/api/dossiers', (req, res) => {
  db.all('SELECT * FROM dossiers ORDER BY created DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows.map(row => ({
      ...row,
      works: JSON.parse(row.works || '[]'),
      docs: JSON.parse(row.docs || '[]'),
      notes: JSON.parse(row.notes || '[]'),
      paid: Boolean(row.paid)
    }));
    res.json(data);
  });
});

// GET single dossier
app.get('/api/dossiers/:id', (req, res) => {
  db.get('SELECT * FROM dossiers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...row,
      works: JSON.parse(row.works || '[]'),
      docs: JSON.parse(row.docs || '[]'),
      notes: JSON.parse(row.notes || '[]'),
      paid: Boolean(row.paid)
    });
  });
});

// CREATE dossier
app.post('/api/dossiers', (req, res) => {
  const { id, client, email, phone, address, dp_number, works, status, assignee, created, updated, paid, amount, docs, notes, client_access, client_token } = req.body;
  const query = `INSERT INTO dossiers (id, client, email, phone, address, dp_number, works, status, assignee, created, updated, paid, amount, docs, notes, client_access, client_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(query, [
    id, client, email, phone, address, dp_number,
    JSON.stringify(works), status, assignee, created, updated,
    paid ? 1 : 0, amount, JSON.stringify(docs), JSON.stringify(notes),
    client_access ? 1 : 0, client_token
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, message: 'Dossier created' });
  });
});

// UPDATE dossier
app.put('/api/dossiers/:id', (req, res) => {
  const { client, email, phone, address, dp_number, works, status, assignee, updated, paid, amount, docs, notes, client_access } = req.body;
  const query = `UPDATE dossiers SET client=?, email=?, phone=?, address=?, dp_number=?, works=?, status=?, assignee=?, updated=?, paid=?, amount=?, docs=?, notes=?, client_access=? WHERE id=?`;
  
  db.run(query, [
    client, email, phone, address, dp_number,
    JSON.stringify(works), status, assignee, updated,
    paid ? 1 : 0, amount, JSON.stringify(docs), JSON.stringify(notes),
    client_access ? 1 : 0, req.params.id
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dossier updated' });
  });
});

// DELETE dossier
app.delete('/api/dossiers/:id', (req, res) => {
  db.run('DELETE FROM dossiers WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dossier deleted' });
  });
});

// ========== AUTH ENDPOINTS ==========

// GET users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role, initials FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      initials: row.initials
    });
  });
});

// ========== INIT ==========

app.listen(PORT, () => {
  console.log(`\n✅ Eco-formalités API Server running on http://localhost:${PORT}`);
  console.log(`📝 Database: ${dbPath}\n`);
});

module.exports = db;
