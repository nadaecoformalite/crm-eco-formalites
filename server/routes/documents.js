const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Upload directory ──────────────────────────────────────────────────────────

const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

// Ensure root upload dir exists
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// ── Document categories ───────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'kbis', 'devis', 'facture', 'dp', 'raccordement',
  'consuel', 'tva', 'contrat', 'plan', 'photo', 'autre'
];

// ── Multer storage — organised by dossier + category ─────────────────────────

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dossierId = req.params.dossierId || req.body.dossier_id || 'non-classe';
    const category  = req.body.category || 'autre';
    const dir = path.join(UPLOAD_ROOT, sanitize(dossierId), sanitize(category));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80);
    const stamp = Date.now();
    cb(null, `${base}_${stamp}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

// ── Helper: sanitize path segment ─────────────────────────────────────────────

function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
}

// ── Helper: file size human-readable ─────────────────────────────────────────

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Helper: build public URL ──────────────────────────────────────────────────

function fileUrl(storagePath) {
  // Strip the UPLOAD_ROOT prefix → relative web path
  const rel = storagePath.replace(UPLOAD_ROOT, '').replace(/\\/g, '/');
  return `/uploads${rel}`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/documents — list documents (filter by dossier_id, category, search)
router.get('/', (req, res) => {
  const { dossier_id, category, search } = req.query;
  let sql = 'SELECT * FROM documents';
  const params = [];
  const conditions = [];

  if (dossier_id) { conditions.push('dossier_id = ?');         params.push(dossier_id); }
  if (category)   { conditions.push('category = ?');           params.push(category); }
  if (search)     { conditions.push('name LIKE ?');             params.push(`%${search}%`); }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created DESC';

  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, url: fileUrl(r.storage_path), size_human: humanSize(r.size || 0) })));
  });
});

// GET /api/documents/:id — single document metadata
router.get('/:id', (req, res) => {
  req.db.get('SELECT * FROM documents WHERE id=?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Document introuvable' });
    res.json({ ...row, url: fileUrl(row.storage_path), size_human: humanSize(row.size || 0) });
  });
});

// GET /api/documents/:id/versions — all versions of a document (by original name)
router.get('/:id/versions', (req, res) => {
  req.db.get('SELECT * FROM documents WHERE id=?', [req.params.id], (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: 'Document introuvable' });
    // Find siblings: same dossier + same original base name
    req.db.all(
      'SELECT * FROM documents WHERE dossier_id=? AND original_name=? ORDER BY version DESC',
      [doc.dossier_id, doc.original_name],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(rows.map(r => ({ ...r, url: fileUrl(r.storage_path), size_human: humanSize(r.size || 0) })));
      }
    );
  });
});

// POST /api/documents/upload/:dossierId — upload one or more files
router.post('/upload/:dossierId', upload.array('files', 10), async (req, res) => {
  const { dossierId } = req.params;
  const category  = req.body.category || 'autre';
  const uploadedBy = req.body.uploaded_by || 'system';
  const extractedData = req.body.extracted_data ? JSON.parse(req.body.extracted_data) : null;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
  }

  const now = new Date().toISOString();
  const saved = [];

  const insertFile = (file) => new Promise((resolve, reject) => {
    // Check if a document with the same original name exists in this dossier → versioning
    req.db.get(
      'SELECT MAX(version) as max_v FROM documents WHERE dossier_id=? AND original_name=?',
      [dossierId, file.originalname],
      (err, row) => {
        if (err) return reject(err);
        const version = (row?.max_v || 0) + 1;

        req.db.run(
          `INSERT INTO documents (dossier_id, name, original_name, mime_type, size, category, storage_path, version, uploaded_by, created, updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dossierId, file.filename, file.originalname, file.mimetype, file.size,
           category, file.path, version, uploadedBy, now, now],
          function (err2) {
            if (err2) return reject(err2);
            resolve({ id: this.lastID, version, filename: file.filename, original: file.originalname });
          }
        );
      }
    );
  });

  try {
    for (const file of req.files) {
      const info = await insertFile(file);
      saved.push(info);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  // If DP number was extracted client-side and dossier doesn't have one yet, update it
  if (extractedData?.dp_number && dossierId) {
    req.db.get('SELECT dp_number FROM dossiers WHERE id=?', [dossierId], (err, dossier) => {
      if (!err && dossier && !dossier.dp_number) {
        req.db.run(
          `UPDATE dossiers SET dp_number=?, updated=? WHERE id=?`,
          [extractedData.dp_number, now, dossierId]
        );
      }
    });
  }

  // If KBIS data was extracted, optionally update dossier fields
  if (extractedData?.kbis && dossierId) {
    const { siret, company_name, address, representant } = extractedData.kbis;
    const updates = [];
    const vals = [];
    if (siret)        { updates.push('siret_extracted=?'); vals.push(siret); }
    // Store in a new field — we won't overwrite existing client data without confirmation
    // (The front-end asks for confirmation before applying)
    // For now, log it as a comment on the dossier
    const note = `KBIS importé — ${company_name || ''} | SIRET: ${siret || ''} | Adresse: ${address || ''} | Représentant: ${representant || ''}`.trim();
    req.db.run(
      `UPDATE dossiers SET updated=? WHERE id=?`,
      [now, dossierId]
    );
    // Return extracted KBIS data so front-end can show confirmation dialog
  }

  res.json({
    saved,
    message: `${saved.length} fichier(s) uploadé(s)`,
    extracted: extractedData || null,
  });
});

// DELETE /api/documents/:id — delete document file + DB record
router.delete('/:id', (req, res) => {
  req.db.get('SELECT * FROM documents WHERE id=?', [req.params.id], (err, doc) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    // Remove file from disk
    fs.unlink(doc.storage_path, (fsErr) => {
      if (fsErr && fsErr.code !== 'ENOENT') {
        console.warn('Impossible de supprimer le fichier physique:', fsErr.message);
      }
      // Delete DB record regardless
      req.db.run('DELETE FROM documents WHERE id=?', [req.params.id], function (dbErr) {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        res.json({ message: 'Document supprimé' });
      });
    });
  });
});

// PUT /api/documents/:id — rename or change category
router.put('/:id', (req, res) => {
  const { name, category } = req.body;
  const now = new Date().toISOString();
  req.db.run(
    'UPDATE documents SET name=?, category=?, updated=? WHERE id=?',
    [name, category, now, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Document mis à jour' });
    }
  );
});

// POST /api/documents/apply-extracted/:dossierId — apply extracted data to dossier
router.post('/apply-extracted/:dossierId', (req, res) => {
  const { dp_number, kbis } = req.body;
  const now = new Date().toISOString();
  const updates = ['updated=?'];
  const vals = [now];

  if (dp_number) { updates.push('dp_number=?'); vals.push(dp_number); }
  vals.push(req.params.dossierId);

  req.db.run(
    `UPDATE dossiers SET ${updates.join(',')} WHERE id=?`,
    vals,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // If KBIS data, optionally update client_org
      if (kbis?.company_name || kbis?.siret) {
        // Return success — front-end handles org update separately
      }
      res.json({ message: 'Données appliquées au dossier' });
    }
  );
});

// Serve static uploads (with security: only files within UPLOAD_ROOT)
router.get('/file/*', (req, res) => {
  const rel = req.params[0];
  const filePath = path.join(UPLOAD_ROOT, rel);
  // Security: ensure resolved path is within UPLOAD_ROOT
  if (!filePath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier introuvable' });
  }
  res.sendFile(filePath);
});

module.exports = { router, UPLOAD_ROOT };
