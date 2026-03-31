// API Configuration
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Token management ─────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.reload();
    throw new Error('Session expirée');
  }

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
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data?.token) {
      setToken(data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    return data?.user || data;
  } catch (err) { console.error('login:', err); return null; }
};

export const getUsers = async () => {
  try { return await request('/users'); }
  catch (err) { console.error('getUsers:', err); return []; }
};

export const updateUserSmtp = async (userId, smtp_password) => {
  try { return await request(`/users/${userId}/smtp`, { method: 'PUT', body: JSON.stringify({ smtp_password }) }); }
  catch (err) { console.error('updateUserSmtp:', err); throw err; }
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

  const token = getToken();
  const res = await fetch(`${API_URL}/documents/upload/${encodeURIComponent(dossierId)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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

export const saveEditedDocument = async (docId, pdfBytes) => {
  const token = getToken();
  const res = await fetch(`${API_URL}/documents/${docId}/save-edited`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: pdfBytes,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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

export const sendEmail = async ({ to, to_name, subject, body_html, body_text, template_id, dossier_id, variables = {}, from_email, from_name, attachments = [] }) => {
  try {
    if (attachments.length > 0) {
      const fd = new FormData();
      if (to)          fd.append('to', to);
      if (to_name)     fd.append('to_name', to_name);
      if (subject)     fd.append('subject', subject);
      if (body_html)   fd.append('body_html', body_html);
      if (body_text)   fd.append('body_text', body_text);
      if (template_id) fd.append('template_id', template_id);
      if (dossier_id)  fd.append('dossier_id', dossier_id);
      if (from_email)  fd.append('from_email', from_email);
      if (from_name)   fd.append('from_name', from_name);
      fd.append('variables', JSON.stringify(variables));
      attachments.forEach(f => fd.append('attachments', f, f.name));
      const token = getToken();
      const res = await fetch(`${API_URL}/emails/send`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }
      return res.json();
    }
    return await request('/emails/send', { method: 'POST', body: JSON.stringify({ to, to_name, subject, body_html, body_text, template_id, dossier_id, variables, from_email, from_name }) });
  }
  catch (err) { console.error('sendEmail:', err); throw err; }
};

export const scheduleEmail = async ({ to, to_name, subject, body_html, body_text, template_id, dossier_id, scheduled_at, variables = {}, from_email, from_name }) => {
  try { return await request('/emails/schedule', { method: 'POST', body: JSON.stringify({ to, to_name, subject, body_html, body_text, template_id, dossier_id, scheduled_at, variables, from_email, from_name }) }); }
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

export const updateQueuedEmail = async (id, data) => {
  try { return await request(`/emails/queue/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  catch (err) { console.error('updateQueuedEmail:', err); throw err; }
};

// ── Email Log ─────────────────────────────────────────────────────────────────

export const getEmailLog = async (filters = {}) => {
  try {
    const params = new URLSearchParams(filters).toString();
    return await request(`/emails/log${params ? '?' + params : ''}`);
  } catch (err) { console.error('getEmailLog:', err); return []; }
};

// ── Urbanisme AI lookup ──────────────────────────────────────────────────────

export const lookupUrbanisme = async (ville, code_postal) => {
  try { return await request('/urbanisme/lookup', { method: 'POST', body: JSON.stringify({ ville, code_postal }) }); }
  catch (err) { console.error('lookupUrbanisme:', err); throw err; }
};
