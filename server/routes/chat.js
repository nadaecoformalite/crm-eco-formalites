const express = require('express');
const router = express.Router();

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/chat/unread-count — total unread messages for a user across all conversations
// (must be declared BEFORE /:id routes to avoid conflict)
router.get('/unread-count', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });

  const sql = `
    SELECT COUNT(*) as count
    FROM chat_messages m
    INNER JOIN chat_participants p ON p.conversation_id = m.conversation_id
    WHERE p.user_id = ?
      AND m.read_by NOT LIKE '%' || ? || '%'
  `;
  req.db.get(sql, [user_id, user_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row ? row.count : 0 });
  });
});

// GET /api/chat/conversations — list conversations (with last message info + unread count)
router.get('/conversations', (req, res) => {
  const { user_id, dossier_id } = req.query;
  const conditions = [];
  const params = [];

  if (user_id) {
    conditions.push('c.id IN (SELECT conversation_id FROM chat_participants WHERE user_id = ?)');
    params.push(user_id);
  }
  // Partenaires : uniquement les conversations liées à leurs dossiers
  if (req.user && req.user.role === 'partenaire') {
    conditions.push('c.dossier_id IN (SELECT id FROM dossiers WHERE created_by = ?)');
    params.push(req.user.id);
  }
  if (dossier_id) {
    conditions.push('c.dossier_id = ?');
    params.push(dossier_id);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

  // Build user_id param references for the unread subquery
  const unreadSelect = user_id
    ? `, (SELECT COUNT(*) FROM chat_messages um WHERE um.conversation_id = c.id AND um.read_by NOT LIKE '%' || ? || '%') as unread_count`
    : ', 0 as unread_count';

  if (user_id) params.push(user_id);

  const sql = `
    SELECT c.*,
      (SELECT content FROM chat_messages lm WHERE lm.conversation_id = c.id ORDER BY lm.created DESC LIMIT 1) as last_message,
      (SELECT created FROM chat_messages lm2 WHERE lm2.conversation_id = c.id ORDER BY lm2.created DESC LIMIT 1) as last_message_time,
      (SELECT sender_id FROM chat_messages lm3 WHERE lm3.conversation_id = c.id ORDER BY lm3.created DESC LIMIT 1) as last_sender_id
      ${unreadSelect}
    FROM chat_conversations c
    ${where}
    ORDER BY c.updated DESC
  `;

  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // For each conversation, fetch participants
    if (!rows.length) return res.json([]);

    let pending = rows.length;
    const results = [];

    rows.forEach((conv, idx) => {
      req.db.all(
        'SELECT * FROM chat_participants WHERE conversation_id = ?',
        [conv.id],
        (err2, participants) => {
          if (err2) participants = [];
          results[idx] = { ...conv, participants };
          pending--;
          if (pending === 0) res.json(results);
        }
      );
    });
  });
});

// POST /api/chat/conversations — create conversation
router.post('/conversations', (req, res) => {
  const { title, dossier_id, type, scope, participant_ids, created_by } = req.body;
  const now = new Date().toISOString();
  // Partenaires : forcer scope externe
  const finalScope = (req.user && req.user.role === 'partenaire') ? 'externe' : (scope || 'interne');

  req.db.run(
    `INSERT INTO chat_conversations (title, dossier_id, type, scope, created_by, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title || null, dossier_id || null, type || 'general', finalScope, created_by, now, now],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const convId = this.lastID;

      // Collect all participant user IDs (include created_by)
      const allIds = new Set(participant_ids || []);
      if (created_by) allIds.add(created_by);

      const ids = [...allIds];
      if (!ids.length) {
        return res.json({ id: convId, message: 'Conversation créée' });
      }

      let pending = ids.length;
      let insertErr = null;

      ids.forEach(uid => {
        req.db.run(
          'INSERT INTO chat_participants (conversation_id, user_id, joined) VALUES (?, ?, ?)',
          [convId, uid, now],
          (err2) => {
            if (err2 && !insertErr) insertErr = err2;
            pending--;
            if (pending === 0) {
              if (insertErr) return res.status(500).json({ error: insertErr.message });
              res.json({ id: convId, message: 'Conversation créée' });
            }
          }
        );
      });
    }
  );
});

// DELETE /api/chat/conversations/:id — delete conversation + cascade
router.delete('/conversations/:id', (req, res) => {
  const convId = req.params.id;

  req.db.run('DELETE FROM chat_messages WHERE conversation_id = ?', [convId], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    req.db.run('DELETE FROM chat_participants WHERE conversation_id = ?', [convId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      req.db.run('DELETE FROM chat_conversations WHERE id = ?', [convId], function (err3) {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ message: 'Conversation supprimée' });
      });
    });
  });
});

// GET /api/chat/conversations/:id/messages — get messages
router.get('/conversations/:id/messages', (req, res) => {
  const convId = req.params.id;
  const limit = parseInt(req.query.limit) || 50;
  const afterId = req.query.after_id;

  let sql = 'SELECT * FROM chat_messages WHERE conversation_id = ?';
  const params = [convId];

  if (afterId) {
    sql += ' AND id > ?';
    params.push(afterId);
  }

  sql += ' ORDER BY created ASC LIMIT ?';
  params.push(limit);

  req.db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/chat/conversations/:id/messages — send message
router.post('/conversations/:id/messages', (req, res) => {
  const convId = req.params.id;
  const { sender_id, content, type, audio_data, audio_duration } = req.body;
  const now = new Date().toISOString();

  req.db.run(
    `INSERT INTO chat_messages (conversation_id, sender_id, content, type, audio_data, audio_duration, read_by, created)
     VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`,
    [convId, sender_id, content || null, type || 'text', audio_data || null, audio_duration || null, now],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const msgId = this.lastID;

      // Update conversation.updated
      req.db.run(
        'UPDATE chat_conversations SET updated = ? WHERE id = ?',
        [now, convId],
        (err2) => {
          if (err2) console.error('Error updating conversation timestamp:', err2.message);

          // Return the inserted message
          req.db.get('SELECT * FROM chat_messages WHERE id = ?', [msgId], (err3, row) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json(row);
          });
        }
      );
    }
  );
});

// PUT /api/chat/conversations/:id/read — mark messages as read
router.put('/conversations/:id/read', (req, res) => {
  const convId = req.params.id;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id requis' });

  // Get all messages in this conversation where read_by does NOT contain user_id
  req.db.all(
    `SELECT id, read_by FROM chat_messages WHERE conversation_id = ? AND read_by NOT LIKE '%' || ? || '%'`,
    [convId, user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.json({ updated: 0 });

      let pending = rows.length;
      let updateErr = null;

      rows.forEach(msg => {
        let readBy;
        try { readBy = JSON.parse(msg.read_by || '[]'); } catch { readBy = []; }
        readBy.push(user_id);
        const newReadBy = JSON.stringify(readBy);

        req.db.run(
          'UPDATE chat_messages SET read_by = ? WHERE id = ?',
          [newReadBy, msg.id],
          (err2) => {
            if (err2 && !updateErr) updateErr = err2;
            pending--;
            if (pending === 0) {
              if (updateErr) return res.status(500).json({ error: updateErr.message });
              res.json({ updated: rows.length });
            }
          }
        );
      });
    }
  );
});

module.exports = { router };
