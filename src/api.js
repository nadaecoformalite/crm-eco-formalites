// API Configuration
const API_URL = 'http://localhost:3001/api';

// DOSSIERS
export const getDossiers = async () => {
  try {
    const res = await fetch(`${API_URL}/dossiers`);
    if (!res.ok) throw new Error('Failed to fetch dossiers');
    return await res.json();
  } catch (err) {
    console.error('getDossiers error:', err);
    return [];
  }
};

export const getDossier = async (id) => {
  try {
    const res = await fetch(`${API_URL}/dossiers/${id}`);
    if (!res.ok) throw new Error('Failed to fetch dossier');
    return await res.json();
  } catch (err) {
    console.error('getDossier error:', err);
    return null;
  }
};

export const createDossier = async (dossier) => {
  try {
    const res = await fetch(`${API_URL}/dossiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dossier)
    });
    if (!res.ok) throw new Error('Failed to create dossier');
    return await res.json();
  } catch (err) {
    console.error('createDossier error:', err);
    return null;
  }
};

export const updateDossier = async (id, dossier) => {
  try {
    const res = await fetch(`${API_URL}/dossiers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dossier)
    });
    if (!res.ok) throw new Error('Failed to update dossier');
    return await res.json();
  } catch (err) {
    console.error('updateDossier error:', err);
    return null;
  }
};

export const deleteDossier = async (id) => {
  try {
    const res = await fetch(`${API_URL}/dossiers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete dossier');
    return await res.json();
  } catch (err) {
    console.error('deleteDossier error:', err);
    return null;
  }
};

// AUTH
export const login = async (email, password) => {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Login failed');
    return await res.json();
  } catch (err) {
    console.error('login error:', err);
    return null;
  }
};

export const getUsers = async () => {
  try {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    return await res.json();
  } catch (err) {
    console.error('getUsers error:', err);
    return [];
  }
};
