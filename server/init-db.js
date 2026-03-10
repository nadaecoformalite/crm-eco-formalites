const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'crm.db');
const db = new sqlite3.Database(dbPath);

// Mock data
const USERS = [
  { id: 1, name: "Super Admin", email: "superadmin@crm.fr", password: "admin2024", role: "superadmin", initials: "SA" },
  { id: 2, name: "Admin", email: "admin@crm.fr", password: "admin123", role: "admin", initials: "AD" },
  { id: 3, name: "Nada", email: "nada@crm.fr", password: "nada123", role: "employee", initials: "NA" },
  { id: 4, name: "Sarah", email: "sarah@crm.fr", password: "sarah123", role: "employee", initials: "SR" },
  { id: 5, name: "David", email: "david@crm.fr", password: "david123", role: "employee", initials: "DA" }
];

const DOSSIERS = [
  {
    id: "DOS-2024-001", client: "Martin Dupont", email: "martin@example.com", phone: "06 12 34 56 78",
    address: "12 rue des Lilas, 75011 Paris", dp_number: "DP 075 111 24 00001",
    works: [{ type: "PAC", dossier_type: "Demande Prealable Raccordement" }, { type: "ITE", dossier_type: "CONSUEL" }],
    status: "en_cours", assignee: "Sarah", created: "2024-11-15", updated: "2024-12-01", paid: false, amount: 1200,
    docs: [{ name: "Devis_Martin.pdf", size: "245 KB", date: "2024-11-15" }],
    notes: [{ author: "Sarah", date: "2024-11-20", text: "Dossier en attente de validation EDF." }],
    client_access: true, client_token: "tok_001"
  },
  {
    id: "DOS-2024-002", client: "Emilie Rousseau", email: "emilie@example.com", phone: "06 98 76 54 32",
    address: "5 avenue Victor Hugo, 69001 Lyon", dp_number: "DP 069 011 24 00042",
    works: [{ type: "Panneaux Solaires", dossier_type: "Recuperation TVA" }],
    status: "valide", assignee: "Nada", created: "2024-10-08", updated: "2024-11-30", paid: true, amount: 800,
    docs: [{ name: "Facture_Panneaux.pdf", size: "180 KB", date: "2024-10-10" }],
    notes: [{ author: "Nada", date: "2024-11-30", text: "Dossier valide, TVA recuperee." }],
    client_access: false, client_token: null
  }
];

db.serialize(() => {
  // Insert users
  USERS.forEach(u => {
    db.run(
      `INSERT OR IGNORE INTO users (id, name, email, password, role, initials) VALUES (?, ?, ?, ?, ?, ?)`,
      [u.id, u.name, u.email, u.password, u.role, u.initials]
    );
  });

  // Insert dossiers
  DOSSIERS.forEach(d => {
    db.run(
      `INSERT OR IGNORE INTO dossiers (id, client, email, phone, address, dp_number, works, status, assignee, created, updated, paid, amount, docs, notes, client_access, client_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.client, d.email, d.phone, d.address, d.dp_number, JSON.stringify(d.works), d.status, d.assignee,
       d.created, d.updated, d.paid ? 1 : 0, d.amount, JSON.stringify(d.docs), JSON.stringify(d.notes),
       d.client_access ? 1 : 0, d.client_token],
      (err) => {
        if (err) console.error('Insert error:', err);
      }
    );
  });

  console.log('✅ Database initialized with sample data');
  db.close();
});
