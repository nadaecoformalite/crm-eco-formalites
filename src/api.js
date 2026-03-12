// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Dossiers ──────────────────────────────────────────────────────────────────

export const getDossiers = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    return await request(`/dossiers${params ? '?' + params : ''}`);
  } catch (err) { console.error('getDossiers:', err); return []; }
};

export const getDossier = async (id) => {
  try { return await request(`/dossiers/${id}`); }
  catch (err) { console.error('getDossier:', err); return null; }
};

export const createDossier = async (dossier) => {
  try { return await request('/dossiers', { method: 'POST', body: JSON.stringify(dossier) }); }
  catch (err) { console.error('createDossier:', err); return null; }
};

export const updateDossier = async (id, dossier) => {
  try { return await request(`/dossiers/${id}`, { method: 'PUT', body: JSON.stringify(dossier) }); }
  catch (err) { console.error('updateDossier:', err); return null; }
};

export const deleteDossier = async (id) => {
  try { return await request(`/dossiers/${id}`, { method: 'DELETE' }); }
  catch (err) { console.error('deleteDossier:', err); return null; }
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = async (email, password) => {
  try { return await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }); }
  catch (err) { console.error('login:', err); return null; }
};

export const getUsers = async () => {
  try { return await request('/users'); }
  catch (err) { console.error('getUsers:', err); return []; }
};

// ── Documents (GED) ──────────────────────────────────────────────────────────

export const getDocuments = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    return await request(`/documents${params ? '?' + params : ''}`);
  } catch (err) { console.error('getDocuments:', err); return []; }
};

export const getDocument = async (id) => {
  try { return await request(`/documents/${id}`); }
  catch (err) { console.error('getDocument:', err); return null; }
};

export const getDocumentVersions = async (id) => {
  try { return await request(`/documents/${id}/versions`); }
  catch (err) { console.error('getDocumentVersions:', err); return []; }
};

/**
 * Upload files to a dossier.
 * @param {string} dossierId
 * @param {File[]} files
 * @param {string} category
 * @param {object} extractedData  — { dp_number?, kbis? } from client-side PDF parsing
 */
export const uploadDocuments = async (dossierId, files, category = 'autre', extractedData = null) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('category', category);
  if (extractedData) formData.append('extracted_data', JSON.stringify(extractedData));

  const res = await fetch(`${API_URL}/documents/upload/${encodeURIComponent(dossierId)}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const deleteDocument = async (id) => {
  try { return await request(`/documents/${id}`, { method: 'DELETE' }); }
  catch (err) { console.error('deleteDocument:', err); throw err; }
};

export const updateDocument = async (id, data) => {
  try { return await request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  catch (err) { console.error('updateDocument:', err); throw err; }
};

export const applyExtractedData = async (dossierId, data) => {
  try { return await request(`/documents/apply-extracted/${encodeURIComponent(dossierId)}`, { method: 'POST', body: JSON.stringify(data) }); }
  catch (err) { console.error('applyExtractedData:', err); throw err; }
};

// ── Email Templates ───────────────────────────────────────────────────────────

export const getEmailTemplates = async () => {
  try { return await request('/emails/templates'); }
  catch (err) { console.error('getEmailTemplates:', err); return []; }
};

export const getEmailTemplate = async (id) => {
  try { return await request(`/emails/templates/${id}`); }
  catch (err) { console.error('getEmailTemplate:', err); return null; }
};

export const createEmailTemplate = async (template) => {
  try { return await request('/emails/templates', { method: 'POST', body: JSON.stringify(template) }); }
  catch (err) { console.error('createEmailTemplate:', err); throw err; }
};

export const updateEmailTemplate = async (id, template) => {
  try { return await request(`/emails/templates/${id}`, { method: 'PUT', body: JSON.stringify(template) }); }
  catch (err) { console.error('updateEmailTemplate:', err); throw err; }
};

export const deleteEmailTemplate = async (id) => {
  try { return await request(`/emails/templates/${id}`, { method: 'DELETE' }); }
  catch (err) { console.error('deleteEmailTemplate:', err); throw err; }
};

// ── Email: Send / Schedule / Preview ─────────────────────────────────────────

export const previewEmail = async ({ template_id, dossier_id, variables = {} }) => {
  try { return await request('/emails/preview', { method: 'POST', body: JSON.stringify({ template_id, dossier_id, variables }) }); }
  catch (err) { console.error('previewEmail:', err); throw err; }
};

export const sendEmail = async ({ to, to_name, subject, body_html, body_text, template_id, dossier_id, variables = {} }) => {
  try { return await request('/emails/send', { method: 'POST', body: JSON.stringify({ to, to_name, subject, body_html, body_text, template_id, dossier_id, variables }) }); }
  catch (err) { console.error('sendEmail:', err); throw err; }
};

export const scheduleEmail = async ({ to, to_name, subject, body_html, body_text, template_id, dossier_id, scheduled_at, variables = {} }) => {
  try { return await request('/emails/schedule', { method: 'POST', body: JSON.stringify({ to, to_name, subject, body_html, body_text, template_id, dossier_id, scheduled_at, variables }) }); }
  catch (err) { console.error('scheduleEmail:', err); throw err; }
};

// ── Email Queue ───────────────────────────────────────────────────────────────

export const getEmailQueue = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    return await request(`/emails/queue${params ? '?' + params : ''}`);
  } catch (err) { console.error('getEmailQueue:', err); return []; }
};

export const cancelQueuedEmail = async (id) => {
  try { return await request(`/emails/queue/${id}`, { method: 'DELETE' }); }
  catch (err) { console.error('cancelQueuedEmail:', err); throw err; }
};

// ── Email Log ─────────────────────────────────────────────────────────────────

export const getEmailLog = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    return await request(`/emails/log${params ? '?' + params : ''}`);
  } catch (err) { console.error('getEmailLog:', err); return []; }
};
