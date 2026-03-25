# crm-eco-formalites
import { useState, useEffect, useRef, useMemo } from "react";

// ============================================================
// MOCK DATA & CONSTANTS
// ============================================================
const EMPLOYEES = ["Nada","Sarah","David","Jimmy","Sonia","Harry","Farah","Fabienne","Ounza","Yaël"];
const WORK_TYPES = ["ITE","PAC","Panneaux Solaires","Système Solaire Combiné","Menuiseries Extérieures"];
const STATUSES = [
  { key:"nouveau", label:"Nouveau", color:"#6366f1" },
  { key:"en_cours", label:"En cours", color:"#f59e0b" },
  { key:"en_attente", label:"En attente", color:"#8b5cf6" },
  { key:"valide", label:"Validé", color:"#10b981" },
  { key:"refuse", label:"Refusé", color:"#ef4444" },
  { key:"termine", label:"Terminé", color:"#059669" },
];
const DOSSIER_TYPES = ["Demande Préalable Raccordement","CONSUEL","Récupération TVA"];

const MOCK_DOSSIERS = [
  {
    id:"DOS-2024-001", client:"Martin Dupont", email:"martin@example.com", phone:"06 12 34 56 78",
    address:"12 rue des Lilas, 75011 Paris", dp_number:"DP 075 111 24 00001",
    works:[{type:"PAC", dossier_type:"Demande Préalable Raccordement"},{type:"ITE", dossier_type:"CONSUEL"}],
    status:"en_cours", assignee:"Sarah", created:"2024-11-15", updated:"2024-12-01",
    paid:false, amount:1200,
    docs:[{name:"Devis_Martin.pdf",size:"245 KB",date:"2024-11-15"},{name:"Photo_facade.jpg",size:"1.2 MB",date:"2024-11-16"}],
    notes:[{author:"Sarah",date:"2024-11-20",text:"Dossier en attente de validation EDF."},{author:"David",date:"2024-11-28",text:"Documents complémentaires envoyés."}],
    client_access:true, client_token:"tok_001"
  },
  {
    id:"DOS-2024-002", client:"Émilie Rousseau", email:"emilie.rousseau@example.com", phone:"06 98 76 54 32",
    address:"5 avenue Victor Hugo, 69001 Lyon", dp_number:"DP 069 011 24 00042",
    works:[{type:"Panneaux Solaires", dossier_type:"Récupération TVA"}],
    status:"valide", assignee:"Nada", created:"2024-10-08", updated:"2024-11-30",
    paid:true, amount:800,
    docs:[{name:"Facture_Panneaux.pdf",size:"180 KB",date:"2024-10-10"}],
    notes:[{author:"Nada",date:"2024-11-30",text:"Dossier validé, TVA récupérée."}],
    client_access:false, client_token:null
  },
  {
    id:"DOS-2024-003", client:"Jean-Pierre Moreau", email:"jp.moreau@example.com", phone:"07 11 22 33 44",
    address:"28 chemin du Moulin, 13300 Salon-de-Provence", dp_number:"DP 013 055 24 00078",
    works:[{type:"Menuiseries Extérieures", dossier_type:"CONSUEL"},{type:"Système Solaire Combiné", dossier_type:"Demande Préalable Raccordement"}],
    status:"nouveau", assignee:"Jimmy", created:"2024-12-05", updated:"2024-12-05",
    paid:false, amount:2500,
    docs:[],
    notes:[],
    client_access:true, client_token:"tok_003"
  },
  {
    id:"DOS-2024-004", client:"Isabelle Bernard", email:"isa.bernard@example.com", phone:"06 55 44 33 22",
    address:"3 rue du Port, 44000 Nantes", dp_number:"DP 044 109 24 00015",
    works:[{type:"ITE", dossier_type:"Récupération TVA"}],
    status:"en_attente", assignee:"Farah", created:"2024-09-20", updated:"2024-11-10",
    paid:false, amount:950,
    docs:[{name:"Plan_isolation.pdf",size:"520 KB",date:"2024-09-22"}],
    notes:[{author:"Farah",date:"2024-11-10",text:"En attente du retour de l'administration."}],
    client_access:false, client_token:null
  },
  {
    id:"DOS-2024-005", client:"Thomas Lefebvre", email:"thomas.l@example.com", phone:"06 77 88 99 00",
    address:"17 boulevard de la République, 33000 Bordeaux", dp_number:"DP 033 063 24 00091",
    works:[{type:"PAC", dossier_type:"Demande Préalable Raccordement"},{type:"PAC", dossier_type:"CONSUEL"}],
    status:"termine", assignee:"Harry", created:"2024-08-01", updated:"2024-11-25",
    paid:true, amount:1800,
    docs:[{name:"Attestation_PAC.pdf",size:"300 KB",date:"2024-11-20"},{name:"CONSUEL_signe.pdf",size:"450 KB",date:"2024-11-25"}],
    notes:[{author:"Harry",date:"2024-11-25",text:"Dossier complet et terminé."}],
    client_access:false, client_token:null
  },
];

// ============================================================
// ICONS
// ============================================================
const Icon = ({ name, size=18, color="currentColor" }) => {
  const icons = {
    home: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    folder: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    plus: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    search: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    filter: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    user: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    users: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    settings: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    bell: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    upload: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    download: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    check: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    edit: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    eye: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    mail: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    credit: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    chartbar: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    import: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    lock: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    logout: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    arrow_left: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    menu: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    chevron_down: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
    sun: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    home2: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
    message: <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  };
  return icons[name] || null;
};

// ============================================================
// STYLES
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0f1e;
  --bg2: #0f1629;
  --bg3: #151d35;
  --bg4: #1c2640;
  --border: rgba(99,102,241,0.15);
  --border2: rgba(99,102,241,0.3);
  --accent: #6366f1;
  --accent2: #818cf8;
  --accent3: #c7d2fe;
  --gold: #f59e0b;
  --green: #10b981;
  --red: #ef4444;
  --purple: #8b5cf6;
  --text: #e2e8f0;
  --text2: #94a3b8;
  --text3: #64748b;
  --radius: 12px;
  --radius2: 8px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --shadow2: 0 2px 12px rgba(99,102,241,0.2);
  font-family: 'DM Sans', sans-serif;
  color: var(--text);
  background: var(--bg);
}
body { background: var(--bg); min-height: 100vh; }

h1,h2,h3,h4,h5 { font-family: 'Syne', sans-serif; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg2); }
::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

/* Layout */
.app { display: flex; min-height: 100vh; }
.sidebar {
  width: 240px; background: var(--bg2); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; position: fixed; top: 0; left: 0;
  height: 100vh; z-index: 100; transition: transform 0.3s ease;
}
.sidebar-logo {
  padding: 24px 20px 20px; border-bottom: 1px solid var(--border);
}
.logo-text { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: var(--text); }
.logo-sub { font-size: 10px; color: var(--accent2); letter-spacing: 0.15em; text-transform: uppercase; margin-top: 2px; }
.sidebar-nav { flex: 1; padding: 16px 12px; overflow-y: auto; }
.nav-section { margin-bottom: 24px; }
.nav-label { font-size: 9px; font-weight: 600; color: var(--text3); letter-spacing: 0.12em; text-transform: uppercase; padding: 0 8px; margin-bottom: 6px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: var(--radius2); cursor: pointer; transition: all 0.2s;
  font-size: 14px; font-weight: 500; color: var(--text2); margin-bottom: 2px;
  border: 1px solid transparent;
}
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: rgba(99,102,241,0.15); color: var(--accent2); border-color: var(--border2); }
.nav-item .badge {
  margin-left: auto; background: var(--accent); color: white; font-size: 10px;
  font-weight: 700; padding: 2px 6px; border-radius: 10px; font-family: 'Syne', sans-serif;
}
.sidebar-user {
  padding: 16px; border-top: 1px solid var(--border);
  display: flex; align-items: center; gap: 10px;
}
.user-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { font-size: 10px; color: var(--accent2); text-transform: uppercase; letter-spacing: 0.08em; }
.main { margin-left: 240px; flex: 1; min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  background: var(--bg2); border-bottom: 1px solid var(--border);
  padding: 0 24px; height: 64px; display: flex; align-items: center; gap: 16px;
  position: sticky; top: 0; z-index: 50;
}
.topbar-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; flex: 1; }
.content { padding: 24px; flex: 1; }

/* Cards */
.card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; transition: border-color 0.2s;
}
.card:hover { border-color: var(--border2); }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; }

/* Stats grid */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 20px; position: relative; overflow: hidden;
}
.stat-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent-color, var(--accent));
}
.stat-value { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
.stat-label { font-size: 12px; color: var(--text2); }
.stat-icon { position: absolute; top: 16px; right: 16px; opacity: 0.2; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
  border-radius: var(--radius2); font-size: 13px; font-weight: 600; cursor: pointer;
  border: none; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
  white-space: nowrap;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: #5558e8; box-shadow: 0 4px 16px rgba(99,102,241,0.4); transform: translateY(-1px); }
.btn-secondary { background: var(--bg3); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover { background: var(--bg4); border-color: var(--border2); }
.btn-danger { background: rgba(239,68,68,0.15); color: var(--red); border: 1px solid rgba(239,68,68,0.3); }
.btn-danger:hover { background: rgba(239,68,68,0.25); }
.btn-success { background: rgba(16,185,129,0.15); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }
.btn-success:hover { background: rgba(16,185,129,0.25); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-icon { padding: 8px; border-radius: var(--radius2); background: var(--bg3); border: 1px solid var(--border); color: var(--text2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
.btn-icon:hover { background: var(--bg4); color: var(--text); border-color: var(--border2); }

/* Status badges */
.status-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; }

/* Search & filters */
.search-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
}
.search-input-wrap {
  position: relative; flex: 1; min-width: 220px;
}
.search-input {
  width: 100%; padding: 10px 16px 10px 40px;
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius2);
  color: var(--text); font-size: 14px; outline: none; transition: border-color 0.2s;
  font-family: 'DM Sans', sans-serif;
}
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; }
.filter-select {
  padding: 10px 14px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius2); color: var(--text); font-size: 13px; outline: none;
  cursor: pointer; font-family: 'DM Sans', sans-serif;
}
.filter-select:focus { border-color: var(--accent); }

/* Table */
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
thead tr { border-bottom: 1px solid var(--border); }
th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
tbody tr { border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.15s; cursor: pointer; }
tbody tr:hover { background: var(--bg3); }
td { padding: 14px 16px; font-size: 13px; vertical-align: middle; }
.td-client { font-weight: 600; font-size: 14px; }
.td-id { font-family: 'Syne', sans-serif; font-size: 12px; color: var(--accent2); font-weight: 600; }

/* Work type chips */
.work-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip {
  padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
  background: rgba(99,102,241,0.15); color: var(--accent2); border: 1px solid rgba(99,102,241,0.2);
  white-space: nowrap;
}
.chip-dossier { background: rgba(139,92,246,0.15); color: #c4b5fd; border-color: rgba(139,92,246,0.2); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: 16px;
  width: 100%; max-width: 760px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1);
}
.modal-header {
  padding: 24px 28px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  position: sticky; top: 0; background: var(--bg2); z-index: 10;
}
.modal-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; }
.modal-body { padding: 24px 28px; }
.modal-footer { padding: 20px 28px; border-top: 1px solid var(--border); display: flex; gap: 12px; justify-content: flex-end; }

/* Form */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: 1/-1; }
label { font-size: 12px; font-weight: 600; color: var(--text2); letter-spacing: 0.04em; }
input, select, textarea {
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius2);
  color: var(--text); padding: 10px 14px; font-size: 14px; outline: none;
  transition: border-color 0.2s; font-family: 'DM Sans', sans-serif; width: 100%;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
textarea { resize: vertical; min-height: 80px; }

/* Detail view */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.detail-section { }
.detail-label { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.detail-value { font-size: 15px; font-weight: 500; }
.detail-block { margin-bottom: 16px; }

/* Doc list */
.doc-item {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius2);
  margin-bottom: 8px; transition: border-color 0.2s;
}
.doc-item:hover { border-color: var(--border2); }
.doc-icon { width: 36px; height: 36px; background: rgba(99,102,241,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.doc-name { font-size: 13px; font-weight: 600; }
.doc-meta { font-size: 11px; color: var(--text3); margin-top: 1px; }

/* Note */
.note-item { padding: 14px; background: var(--bg3); border-radius: var(--radius2); border-left: 3px solid var(--accent); margin-bottom: 10px; }
.note-meta { font-size: 11px; color: var(--text3); margin-bottom: 6px; display: flex; gap: 8px; }
.note-text { font-size: 13px; line-height: 1.6; }

/* Payment */
.payment-banner {
  background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.1));
  border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius); padding: 20px;
  display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
}
.payment-amount { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: var(--green); }
.payment-label { font-size: 12px; color: var(--text2); }

/* Login */
.login-page {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--bg);
  background-image: radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.1) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 50%, rgba(139,92,246,0.08) 0%, transparent 50%);
}
.login-card {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: 20px;
  padding: 48px 40px; width: 100%; max-width: 420px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.5);
}
.login-logo { text-align: center; margin-bottom: 32px; }
.login-logo h1 { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; }
.login-logo p { color: var(--text2); font-size: 13px; margin-top: 6px; }
.login-form { display: flex; flex-direction: column; gap: 16px; }
.login-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius2); padding: 12px; color: var(--red); font-size: 13px; }

/* Toast */
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
.toast {
  background: var(--bg4); border: 1px solid var(--border2); border-radius: var(--radius);
  padding: 14px 18px; display: flex; align-items: center; gap: 12px;
  box-shadow: var(--shadow); min-width: 280px; max-width: 380px;
  animation: slideIn 0.3s ease;
}
.toast.success { border-color: rgba(16,185,129,0.4); }
.toast.error { border-color: rgba(239,68,68,0.4); }
.toast.info { border-color: rgba(99,102,241,0.4); }
@keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
.toast-msg { font-size: 13px; flex: 1; }

/* Tabs */
.tabs { display: flex; gap: 4px; padding: 4px; background: var(--bg3); border-radius: var(--radius2); margin-bottom: 20px; width: fit-content; }
.tab {
  padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;
  color: var(--text2); transition: all 0.2s; border: none; background: transparent;
  font-family: 'DM Sans', sans-serif;
}
.tab.active { background: var(--accent); color: white; font-weight: 600; }
.tab:not(.active):hover { color: var(--text); background: var(--bg4); }

/* Assignee avatar */
.assignee-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
  border-radius: 20px; padding: 3px 10px 3px 4px; font-size: 12px; font-weight: 500;
}
.assignee-avatar {
  width: 20px; height: 20px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: white;
}

/* Upload zone */
.upload-zone {
  border: 2px dashed var(--border2); border-radius: var(--radius); padding: 32px;
  text-align: center; cursor: pointer; transition: all 0.2s;
}
.upload-zone:hover { border-color: var(--accent); background: rgba(99,102,241,0.05); }
.upload-zone.dragging { border-color: var(--accent); background: rgba(99,102,241,0.1); }
.upload-zone p { color: var(--text2); font-size: 13px; margin-top: 8px; }

/* Mobile menu */
.mobile-menu-btn { display: none; }
.sidebar-overlay { display: none; }

/* Notification dot */
.notif-dot { width: 8px; height: 8px; background: var(--red); border-radius: 50%; position: absolute; top: 6px; right: 6px; }

/* Work row for dossier with multiple travaux */
.work-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }

/* Dashboard specific */
.activity-item { display: flex; gap: 12px; margin-bottom: 16px; }
.activity-line { position: relative; }
.activity-line::after { content: ''; position: absolute; left: 14px; top: 28px; bottom: -16px; width: 1px; background: var(--border); }
.activity-dot { width: 28px; height: 28px; border-radius: 50%; background: var(--bg4); border: 2px solid var(--border2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-content { flex: 1; }
.activity-text { font-size: 13px; }
.activity-time { font-size: 11px; color: var(--text3); margin-top: 2px; }

/* Employee distribution */
.emp-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.emp-name { font-size: 12px; font-weight: 600; width: 70px; flex-shrink: 0; }
.emp-track { flex: 1; background: var(--bg4); border-radius: 4px; height: 8px; overflow: hidden; }
.emp-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--purple)); transition: width 1s ease; }
.emp-count { font-size: 11px; color: var(--text3); width: 20px; text-align: right; flex-shrink: 0; }

/* Import zone */
.import-modal { max-width: 560px; }

@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
  .main { margin-left: 0; }
  .mobile-menu-btn { display: flex; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .modal { border-radius: 12px; }
  .content { padding: 16px; }
  .topbar { padding: 0 16px; }
  table { font-size: 12px; }
  td, th { padding: 10px 8px; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
  .login-card { padding: 32px 24px; }
  .modal-body { padding: 16px; }
  .modal-header { padding: 16px; }
  .modal-footer { padding: 16px; }
}
`;

// ============================================================
// AUTH USERS
// ============================================================
const USERS = [
  { id:1, name:"Super Admin", email:"superadmin@crm.fr", password:"admin2024", role:"superadmin", initials:"SA" },
  { id:2, name:"Admin", email:"admin@crm.fr", password:"admin123", role:"admin", initials:"AD" },
  { id:3, name:"Nada", email:"nada@crm.fr", password:"nada123", role:"employee", initials:"NA" },
];

// ============================================================
// TOAST SYSTEM
// ============================================================
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{fontSize:18}}>
            {t.type==='success'?'✓':t.type==='error'?'✕':'ℹ'}
          </span>
          <span className="toast-msg">{t.msg}</span>
          <button className="btn-icon" style={{padding:4,border:'none',background:'none'}} onClick={()=>removeToast(t.id)}>
            <Icon name="x" size={14}/>
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }) {
  const s = STATUSES.find(x=>x.key===status) || STATUSES[0];
  return (
    <span className="status-badge" style={{ background:`${s.color}18`, color:s.color, border:`1px solid ${s.color}35` }}>
      <span className="status-dot" style={{background:s.color}}/>
      {s.label}
    </span>
  );
}

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    const user = USERS.find(u=>u.email===email && u.password===password);
    if (user) { onLogin(user); }
    else { setError('Email ou mot de passe incorrect.'); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:8}}>
            <div style={{width:40,height:40,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name="sun" color="white" size={20}/>
            </div>
          </div>
          <h1>SolarCRM Pro</h1>
          <p>Gestion des dossiers énergétiques</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="login-form">
          <div className="form-group">
            <label>Adresse email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.fr" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          </div>
          <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:'14px'}} onClick={handleLogin}>
            <Icon name="lock" size={16}/> Se connecter
          </button>
        </div>
        <p style={{textAlign:'center',marginTop:20,fontSize:12,color:'var(--text3)'}}>
          superadmin@crm.fr / admin2024 · admin@crm.fr / admin123
        </p>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ active, setActive, currentUser, onLogout, sidebarOpen, setSidebarOpen, dossiers }) {
  const pending = dossiers.filter(d=>!d.paid).length;
  const navItems = [
    { id:'dashboard', icon:'chartbar', label:'Tableau de bord', section:'main' },
    { id:'dossiers', icon:'folder', label:'Dossiers', badge: dossiers.length, section:'main' },
    { id:'clients', icon:'users', label:'Clients', section:'main' },
    { id:'paiements', icon:'credit', label:'Paiements', badge: pending, section:'main' },
    { id:'import', icon:'import', label:'Import données', section:'main' },
    ...(currentUser.role==='superadmin' ? [{ id:'admin', icon:'settings', label:'Administration', section:'admin' }] : []),
  ];
  const sections = [...new Set(navItems.map(n=>n.section))];
  const sectionLabels = { main:'Navigation', admin:'Super Admin' };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <div className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon name="sun" color="white" size={16}/>
            </div>
            <div>
              <div className="logo-text">SolarCRM</div>
              <div className="logo-sub">Pro</div>
            </div>
          </div>
        </div>
        <div className="sidebar-nav">
          {sections.map(sec=>(
            <div className="nav-section" key={sec}>
              <div className="nav-label">{sectionLabels[sec]}</div>
              {navItems.filter(n=>n.section===sec).map(item=>(
                <div key={item.id} className={`nav-item ${active===item.id?'active':''}`} onClick={()=>{setActive(item.id);setSidebarOpen(false);}}>
                  <Icon name={item.icon} size={16}/>
                  <span>{item.label}</span>
                  {item.badge>0 && <span className="badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">{currentUser.initials}</div>
          <div className="user-info">
            <div className="user-name">{currentUser.name}</div>
            <div className="user-role">{currentUser.role}</div>
          </div>
          <button className="btn-icon" onClick={onLogout} title="Déconnexion" style={{border:'none',background:'none',padding:6}}>
            <Icon name="logout" size={16} color="var(--text3)"/>
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ dossiers, currentUser }) {
  const total = dossiers.length;
  const enCours = dossiers.filter(d=>d.status==='en_cours').length;
  const termines = dossiers.filter(d=>d.status==='termine').length;
  const paiementsAttente = dossiers.filter(d=>!d.paid).length;
  const totalRevenu = dossiers.filter(d=>d.paid).reduce((s,d)=>s+d.amount,0);

  const statusDist = STATUSES.map(s=>({ ...s, count: dossiers.filter(d=>d.status===s.key).length }));
  const empDist = EMPLOYEES.map(e=>({ name:e, count: dossiers.filter(d=>d.assignee===e).length })).filter(e=>e.count>0).sort((a,b)=>b.count-a.count);
  const maxEmp = Math.max(...empDist.map(e=>e.count),1);

  return (
    <div>
      <div className="stats-grid">
        {[
          { label:'Dossiers total', value:total, icon:'folder', color:'#6366f1' },
          { label:'En cours', value:enCours, icon:'chartbar', color:'#f59e0b' },
          { label:'Terminés', value:termines, icon:'check', color:'#10b981' },
          { label:'Paiements en attente', value:paiementsAttente, icon:'credit', color:'#ef4444' },
        ].map((s,i)=>(
          <div className="stat-card" key={i} style={{'--accent-color':s.color}}>
            <div className="stat-icon"><Icon name={s.icon} size={40} color={s.color}/></div>
            <div className="stat-value" style={{color:s.color}}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20}}>
        <div className="card">
          <div className="card-header"><div className="card-title">Statuts des dossiers</div></div>
          {statusDist.map(s=>(
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <span className="status-dot" style={{width:8,height:8,background:s.color,borderRadius:'50%',flexShrink:0}}/>
              <span style={{fontSize:13,flex:1}}>{s.label}</span>
              <div style={{flex:2,background:'var(--bg4)',borderRadius:4,height:8,overflow:'hidden'}}>
                <div style={{width:`${total?s.count/total*100:0}%`,height:'100%',background:s.color,borderRadius:4,transition:'width 1s ease'}}/>
              </div>
              <span style={{fontSize:12,color:'var(--text3)',width:20,textAlign:'right'}}>{s.count}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Charge par employé</div></div>
          {empDist.slice(0,6).map(e=>(
            <div className="emp-bar" key={e.name}>
              <span className="emp-name">{e.name}</span>
              <div className="emp-track"><div className="emp-fill" style={{width:`${e.count/maxEmp*100}%`}}/></div>
              <span className="emp-count">{e.count}</span>
            </div>
          ))}
          {empDist.length===0 && <p style={{color:'var(--text3)',fontSize:13}}>Aucun dossier attribué</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Revenus encaissés</div>
          <div style={{fontSize:24,fontWeight:800,color:'var(--green)',fontFamily:'Syne,sans-serif'}}>{totalRevenu.toLocaleString('fr-FR')} €</div>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
          {WORK_TYPES.map(wt=>{
            const count = dossiers.filter(d=>d.works.some(w=>w.type===wt)).length;
            return (
              <div key={wt} style={{background:'var(--bg3)',borderRadius:'var(--radius2)',padding:'12px 16px',flex:'1',minWidth:140}}>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{wt}</div>
                <div style={{fontSize:22,fontWeight:700,fontFamily:'Syne,sans-serif'}}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DOSSIER FORM
// ============================================================
function DossierForm({ initial, onSave, onClose, currentUser }) {
  const empty = { client:'', email:'', phone:'', address:'', dp_number:'', works:[{type:'PAC',dossier_type:'Demande Préalable Raccordement'}], status:'nouveau', assignee:EMPLOYEES[0], paid:false, amount:0, client_access:false, notes:[], docs:[] };
  const [form, setForm] = useState(initial ? { ...initial } : empty);

  const set = (key,val) => setForm(f=>({...f,[key]:val}));
  const setWork = (i,key,val) => {
    const works = [...form.works];
    works[i] = {...works[i],[key]:val};
    set('works',works);
  };
  const addWork = () => set('works',[...form.works,{type:'PAC',dossier_type:'Demande Préalable Raccordement'}]);
  const removeWork = i => set('works',form.works.filter((_,idx)=>idx!==i));

  const handleSave = () => {
    if (!form.client.trim()) return;
    const now = new Date().toISOString().split('T')[0];
    onSave({
      ...form,
      id: initial?.id || `DOS-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`,
      created: initial?.created || now,
      updated: now,
      docs: initial?.docs || [],
      notes: initial?.notes || [],
      client_token: form.client_access ? (initial?.client_token || `tok_${Date.now()}`) : null,
    });
  };

  const canEditAll = currentUser.role !== 'employee';

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{initial?'Modifier le dossier':'Nouveau dossier'}</div>
            {initial && <div style={{fontSize:12,color:'var(--accent2)',marginTop:4,fontFamily:'Syne,sans-serif'}}>{initial.id}</div>}
          </div>
          <button className="btn-icon" onClick={onClose}><Icon name="x"/></button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.08em',fontSize:11}}>Informations client</div>
            <div className="form-grid">
              <div className="form-group"><label>Nom du client *</label><input value={form.client} onChange={e=>set('client',e.target.value)} placeholder="Prénom Nom"/></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="client@email.fr"/></div>
              <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="06 XX XX XX XX"/></div>
              <div className="form-group"><label>Numéro DP</label><input value={form.dp_number} onChange={e=>set('dp_number',e.target.value)} placeholder="DP 075 111 24 00001"/></div>
              <div className="form-group full"><label>Adresse</label><input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Adresse complète"/></div>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Travaux</div>
              <button className="btn btn-secondary btn-sm" onClick={addWork}><Icon name="plus" size={14}/>Ajouter</button>
            </div>
            {form.works.map((w,i)=>(
              <div key={i} style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,padding:'10px 12px',background:'var(--bg3)',borderRadius:'var(--radius2)',border:'1px solid var(--border)'}}>
                <div style={{flex:1}}>
                  <select value={w.type} onChange={e=>setWork(i,'type',e.target.value)} style={{marginBottom:6}}>
                    {WORK_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <select value={w.dossier_type} onChange={e=>setWork(i,'dossier_type',e.target.value)}>
                    {DOSSIER_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                {form.works.length>1 && <button className="btn-icon" onClick={()=>removeWork(i)}><Icon name="x" size={14}/></button>}
              </div>
            ))}
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Statut</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)}>
                {STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Responsable</label>
              <select value={form.assignee} onChange={e=>set('assignee',e.target.value)}>
                {EMPLOYEES.map(e=><option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Montant (€)</label>
              <input type="number" value={form.amount} onChange={e=>set('amount',Number(e.target.value))} placeholder="0"/>
            </div>
            <div className="form-group" style={{justifyContent:'flex-end',paddingTop:8}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:500}}>
                <input type="checkbox" checked={form.paid} onChange={e=>set('paid',e.target.checked)} style={{width:'auto',accentColor:'var(--green)'}}/>
                Payé
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:500,marginTop:8}}>
                <input type="checkbox" checked={form.client_access} onChange={e=>set('client_access',e.target.checked)} style={{width:'auto',accentColor:'var(--accent)'}}/>
                Accès client externe
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave}><Icon name="check" size={16}/>{initial?'Enregistrer':'Créer le dossier'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DOSSIER DETAIL
// ============================================================
function DossierDetail({ dossier, onClose, onUpdate, currentUser, addToast }) {
  const [tab, setTab] = useState('info');
  const [noteText, setNoteText] = useState('');
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState({ ...dossier });
  const fileRef = useRef();

  const save = (updates) => {
    const updated = { ...d, ...updates, updated: new Date().toISOString().split('T')[0] };
    setD(updated);
    onUpdate(updated);
    addToast('Dossier mis à jour','success');
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const notes = [...d.notes, { author: currentUser.name, date: new Date().toISOString().split('T')[0], text: noteText }];
    save({ notes });
    setNoteText('');
  };

  const handleFile = (files) => {
    const newDocs = Array.from(files).map(f=>({ name:f.name, size:`${(f.size/1024).toFixed(0)} KB`, date: new Date().toISOString().split('T')[0] }));
    save({ docs:[...d.docs,...newDocs] });
    addToast(`${newDocs.length} fichier(s) ajouté(s)`,'success');
  };

  const removeDoc = (i) => {
    const docs = d.docs.filter((_,idx)=>idx!==i);
    save({ docs });
  };

  const statusObj = STATUSES.find(s=>s.key===d.status);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:860}}>
        <div className="modal-header">
          <div>
            <div style={{fontSize:12,color:'var(--accent2)',fontFamily:'Syne,sans-serif',fontWeight:600,marginBottom:4}}>{d.id}</div>
            <div className="modal-title">{d.client}</div>
            <div style={{fontSize:13,color:'var(--text2)',marginTop:4}}>{d.address}</div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
            {(currentUser.role!=='employee') && (
              <button className="btn btn-secondary btn-sm" onClick={()=>setEditing(true)}><Icon name="edit" size={14}/>Modifier</button>
            )}
            <button className="btn-icon" onClick={onClose}><Icon name="x"/></button>
          </div>
        </div>

        <div style={{padding:'0 28px'}}>
          <div className="tabs">
            {['info','documents','notes','paiement'].map(t=>(
              <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
                {t==='info'?'Informations':t==='documents'?'Documents':t==='notes'?'Notes & historique':'Paiement'}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{paddingTop:4}}>
          {tab==='info' && (
            <div>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
                <StatusBadge status={d.status}/>
                <span className="assignee-chip">
                  <span className="assignee-avatar">{d.assignee[0]}</span>
                  {d.assignee}
                </span>
                {d.client_access && <span className="chip">Accès client activé</span>}
              </div>
              <div className="detail-grid">
                <div>
                  {[['Email',d.email],['Téléphone',d.phone],['Adresse',d.address],['N° DP',d.dp_number]].map(([l,v])=>(
                    <div className="detail-block" key={l}>
                      <div className="detail-label">{l}</div>
                      <div className="detail-value">{v||'—'}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="detail-block">
                    <div className="detail-label">Travaux</div>
                    {d.works.map((w,i)=>(
                      <div key={i} style={{marginBottom:8}}>
                        <span className="chip" style={{marginRight:4}}>{w.type}</span>
                        <span className="chip chip-dossier">{w.dossier_type}</span>
                      </div>
                    ))}
                  </div>
                  <div className="detail-block">
                    <div className="detail-label">Créé le</div>
                    <div className="detail-value">{d.created}</div>
                  </div>
                  <div className="detail-block">
                    <div className="detail-label">Dernière modification</div>
                    <div className="detail-value">{d.updated}</div>
                  </div>
                </div>
              </div>
              {d.client_access && d.client_token && (
                <div style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius2)',padding:14,marginTop:8}}>
                  <div className="detail-label" style={{marginBottom:6}}>Lien d'accès client</div>
                  <code style={{fontSize:12,color:'var(--accent2)',wordBreak:'break-all'}}>
                    https://solarcrm.fr/client/{d.client_token}
                  </code>
                  <button className="btn btn-secondary btn-sm" style={{marginLeft:12}} onClick={()=>{ navigator.clipboard?.writeText(`https://solarcrm.fr/client/${d.client_token}`); addToast('Lien copié','success'); }}>
                    Copier
                  </button>
                </div>
              )}
            </div>
          )}

          {tab==='documents' && (
            <div>
              <div className="upload-zone" onClick={()=>fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('dragging')}}
                onDragLeave={e=>e.currentTarget.classList.remove('dragging')}
                onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('dragging');handleFile(e.dataTransfer.files);}}>
                <Icon name="upload" size={32} color="var(--text3)"/>
                <p>Glissez-déposez ou cliquez pour ajouter des fichiers</p>
                <p style={{fontSize:11,marginTop:4}}>PDF, JPG, PNG, DOCX…</p>
              </div>
              <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>handleFile(e.target.files)}/>
              <div style={{marginTop:16}}>
                {d.docs.length===0 && <p style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:20}}>Aucun document pour l'instant</p>}
                {d.docs.map((doc,i)=>(
                  <div className="doc-item" key={i}>
                    <div className="doc-icon"><Icon name="download" size={18} color="var(--accent2)"/></div>
                    <div style={{flex:1}}>
                      <div className="doc-name">{doc.name}</div>
                      <div className="doc-meta">{doc.size} · {doc.date}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={()=>addToast(`Téléchargement de ${doc.name}`,'info')}>
                      <Icon name="download" size={13}/>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={()=>removeDoc(i)}>
                      <Icon name="trash" size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='notes' && (
            <div>
              <div style={{display:'flex',gap:10,marginBottom:20}}>
                <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Ajouter une note ou un commentaire..." style={{flex:1,minHeight:70}}/>
                <button className="btn btn-primary" style={{alignSelf:'flex-end'}} onClick={addNote}>
                  <Icon name="message" size={15}/>Envoyer
                </button>
              </div>
              {d.notes.length===0 && <p style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:20}}>Aucune note pour l'instant</p>}
              {[...d.notes].reverse().map((n,i)=>(
                <div className="note-item" key={i}>
                  <div className="note-meta">
                    <strong style={{color:'var(--accent2)'}}>{n.author}</strong>
                    <span>{n.date}</span>
                  </div>
                  <div className="note-text">{n.text}</div>
                </div>
              ))}
            </div>
          )}

          {tab==='paiement' && (
            <div>
              <div className="payment-banner">
                <div style={{flex:1}}>
                  <div className="payment-label">Montant du dossier</div>
                  <div className="payment-amount">{d.amount.toLocaleString('fr-FR')} €</div>
                  <div style={{marginTop:8}}>
                    <StatusBadge status={d.paid?'valide':'en_attente'}/>
                    <span style={{marginLeft:8,fontSize:12,color:'var(--text2)'}}>{d.paid?'Paiement reçu':'En attente de paiement'}</span>
                  </div>
                </div>
                {!d.paid && (
                  <div>
                    <div style={{fontSize:12,color:'var(--text2)',marginBottom:12,textAlign:'center'}}>Lien de paiement client</div>
                    <button className="btn btn-success" onClick={()=>addToast('Lien de paiement envoyé au client par email','success')}>
                      <Icon name="mail" size={15}/>Envoyer le lien
                    </button>
                  </div>
                )}
              </div>
              {currentUser.role==='superadmin' && (
                <div style={{display:'flex',gap:12}}>
                  <button className="btn btn-success" disabled={d.paid} onClick={()=>save({paid:true})}>
                    <Icon name="check" size={15}/> Marquer comme payé
                  </button>
                  <button className="btn btn-danger" disabled={!d.paid} onClick={()=>save({paid:false})}>
                    Annuler le paiement
                  </button>
                </div>
              )}
              <div style={{marginTop:20,padding:14,background:'var(--bg3)',borderRadius:'var(--radius2)',fontSize:13,color:'var(--text2)'}}>
                <Icon name="bell" size={14}/> Le super administrateur est notifié par email lors de chaque paiement reçu.
              </div>
            </div>
          )}
        </div>
      </div>
      {editing && <DossierForm initial={d} onSave={u=>{setD(u);onUpdate(u);setEditing(false);addToast('Dossier modifié','success');}} onClose={()=>setEditing(false)} currentUser={currentUser}/>}
    </div>
  );
}

// ============================================================
// DOSSIERS LIST
// ============================================================
function DossiersPage({ dossiers, setDossiers, currentUser, addToast }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterWork, setFilterWork] = useState('all');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(()=>{
    return dossiers.filter(d=>{
      const q = search.toLowerCase();
      const matchSearch = !q || d.client.toLowerCase().includes(q) || d.address.toLowerCase().includes(q) || d.dp_number.toLowerCase().includes(q) || d.email.toLowerCase().includes(q);
      const matchStatus = filterStatus==='all' || d.status===filterStatus;
      const matchAssignee = filterAssignee==='all' || d.assignee===filterAssignee;
      const matchWork = filterWork==='all' || d.works.some(w=>w.type===filterWork);
      return matchSearch && matchStatus && matchAssignee && matchWork;
    });
  },[dossiers,search,filterStatus,filterAssignee,filterWork]);

  const createDossier = (d) => {
    setDossiers(prev=>[d,...prev]);
    setCreating(false);
    addToast('Dossier créé avec succès','success');
  };
  const updateDossier = (d) => {
    setDossiers(prev=>prev.map(x=>x.id===d.id?d:x));
    if (selected?.id===d.id) setSelected(d);
  };
  const deleteDossier = (id) => {
    setDossiers(prev=>prev.filter(x=>x.id!==id));
    setSelected(null);
    addToast('Dossier supprimé','info');
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800}}>Dossiers</h2>
          <p style={{color:'var(--text2)',fontSize:13,marginTop:2}}>{filtered.length} dossier{filtered.length!==1?'s':''} {dossiers.length!==filtered.length?`sur ${dossiers.length}`:''}</p>
        </div>
        {currentUser.role!=='employee' && (
          <button className="btn btn-primary" onClick={()=>setCreating(true)}><Icon name="plus" size={16}/>Nouveau dossier</button>
        )}
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <span className="search-icon"><Icon name="search" size={16} color="var(--text3)"/></span>
          <input className="search-input" placeholder="Chercher par nom, adresse, n° DP…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">Tous statuts</option>
          {STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="filter-select" value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)}>
          <option value="all">Tous responsables</option>
          {EMPLOYEES.map(e=><option key={e}>{e}</option>)}
        </select>
        <select className="filter-select" value={filterWork} onChange={e=>setFilterWork(e.target.value)}>
          <option value="all">Tous travaux</option>
          {WORK_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Adresse</th>
                <th>Travaux</th>
                <th>Responsable</th>
                <th>Statut</th>
                <th>Paiement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Aucun dossier trouvé</td></tr>
              )}
              {filtered.map(d=>(
                <tr key={d.id} onClick={()=>setSelected(d)}>
                  <td className="td-id">{d.id}</td>
                  <td className="td-client">{d.client}</td>
                  <td style={{color:'var(--text2)',fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.address}</td>
                  <td>
                    <div className="work-chips">
                      {d.works.map((w,i)=><span key={i} className="chip">{w.type}</span>)}
                    </div>
                  </td>
                  <td><span className="assignee-chip"><span className="assignee-avatar">{d.assignee[0]}</span>{d.assignee}</span></td>
                  <td><StatusBadge status={d.status}/></td>
                  <td>
                    <span style={{color:d.paid?'var(--green)':'var(--text3)',fontSize:12,fontWeight:600}}>
                      {d.paid?'✓ Payé':'En attente'}
                    </span>
                  </td>
                  <td onClick={e=>e.stopPropagation()}>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn-icon" onClick={()=>setSelected(d)} title="Voir"><Icon name="eye" size={14}/></button>
                      {currentUser.role==='superadmin' && (
                        <button className="btn-icon" onClick={()=>deleteDossier(d.id)} title="Supprimer" style={{color:'var(--red)'}}><Icon name="trash" size={14}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <DossierForm onSave={createDossier} onClose={()=>setCreating(false)} currentUser={currentUser}/>}
      {selected && <DossierDetail dossier={selected} onClose={()=>setSelected(null)} onUpdate={updateDossier} currentUser={currentUser} addToast={addToast}/>}
    </div>
  );
}

// ============================================================
// CLIENTS PAGE
// ============================================================
function ClientsPage({ dossiers, addToast }) {
  const [search, setSearch] = useState('');
  const clients = useMemo(()=>{
    const map = {};
    dossiers.forEach(d=>{ if (!map[d.email]) map[d.email] = {...d, dossier_count:0}; map[d.email].dossier_count++; });
    return Object.values(map).filter(c=>!search||(c.client.toLowerCase().includes(search.toLowerCase())||c.email.toLowerCase().includes(search.toLowerCase())||c.address.toLowerCase().includes(search.toLowerCase())));
  },[dossiers,search]);

  return (
    <div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,marginBottom:4}}>Clients</h2>
      <p style={{color:'var(--text2)',fontSize:13,marginBottom:20}}>{clients.length} client{clients.length!==1?'s':''}</p>
      <div className="search-bar" style={{marginBottom:20}}>
        <div className="search-input-wrap">
          <span className="search-icon"><Icon name="search" size={16} color="var(--text3)"/></span>
          <input className="search-input" placeholder="Chercher par nom, email, adresse…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
        {clients.map(c=>(
          <div className="card" key={c.email} style={{cursor:'default'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
              <div className="user-avatar" style={{width:44,height:44,fontSize:16}}>{c.client[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}>{c.client}</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>{c.email}</div>
              </div>
              <span style={{background:'var(--accent)',color:'white',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>
                {c.dossier_count} dossier{c.dossier_count!==1?'s':''}
              </span>
            </div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>{c.phone}</div>
            <div style={{fontSize:12,color:'var(--text2)'}}>{c.address}</div>
            <div style={{marginTop:12,display:'flex',gap:8}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>addToast(`Email envoyé à ${c.client}`,'success')}>
                <Icon name="mail" size={13}/>Email
              </button>
              {c.client_access && <span className="chip" style={{alignSelf:'center'}}>Accès client</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PAIEMENTS PAGE
// ============================================================
function PaiementsPage({ dossiers, setDossiers, currentUser, addToast }) {
  const unpaid = dossiers.filter(d=>!d.paid);
  const paid = dossiers.filter(d=>d.paid);
  const totalPaid = paid.reduce((s,d)=>s+d.amount,0);
  const totalPending = unpaid.reduce((s,d)=>s+d.amount,0);

  const markPaid = (id) => {
    setDossiers(prev=>prev.map(d=>d.id===id?{...d,paid:true,updated:new Date().toISOString().split('T')[0]}:d));
    addToast('Paiement validé — notification envoyée au super admin','success');
  };

  return (
    <div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,marginBottom:20}}>Paiements</h2>
      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card" style={{'--accent-color':'var(--green)'}}>
          <div className="stat-value" style={{color:'var(--green)'}}>{totalPaid.toLocaleString('fr-FR')} €</div>
          <div className="stat-label">Encaissé</div>
        </div>
        <div className="stat-card" style={{'--accent-color':'var(--gold)'}}>
          <div className="stat-value" style={{color:'var(--gold)'}}>{totalPending.toLocaleString('fr-FR')} €</div>
          <div className="stat-label">En attente</div>
        </div>
        <div className="stat-card" style={{'--accent-color':'var(--accent)'}}>
          <div className="stat-value">{paid.length}</div>
          <div className="stat-label">Dossiers payés</div>
        </div>
        <div className="stat-card" style={{'--accent-color':'var(--red)'}}>
          <div className="stat-value" style={{color:'var(--red)'}}>{unpaid.length}</div>
          <div className="stat-label">En attente</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><div className="card-title">En attente de paiement</div></div>
        {unpaid.length===0 && <p style={{color:'var(--text3)',fontSize:13}}>Tous les dossiers sont payés 🎉</p>}
        {unpaid.map(d=>(
          <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontWeight:600,fontSize:14}}>{d.client}</div>
              <div style={{fontSize:12,color:'var(--text3)'}}>{d.id} · {d.assignee}</div>
            </div>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:18,color:'var(--gold)'}}>{d.amount.toLocaleString('fr-FR')} €</div>
            <button className="btn btn-secondary btn-sm" onClick={()=>addToast(`Lien de paiement envoyé à ${d.client}`,'info')}>
              <Icon name="mail" size={13}/>Envoyer lien
            </button>
            {currentUser.role==='superadmin' && (
              <button className="btn btn-success btn-sm" onClick={()=>markPaid(d.id)}>
                <Icon name="check" size={13}/>Valider
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Paiements reçus</div></div>
        {paid.map(d=>(
          <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)',flexWrap:'wrap'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{d.client}</div>
              <div style={{fontSize:12,color:'var(--text3)'}}>{d.id}</div>
            </div>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16,color:'var(--green)'}}>{d.amount.toLocaleString('fr-FR')} €</div>
            <span style={{color:'var(--green)',fontSize:12,fontWeight:600}}>✓ Payé</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// IMPORT PAGE
// ============================================================
function ImportPage({ setDossiers, addToast }) {
  const [dragging, setDragging] = useState(false);
  const [imported, setImported] = useState([]);
  const fileRef = useRef();

  const handleFile = (files) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        // Parse CSV or JSON
        let rows = [];
        if (file.name.endsWith('.json')) {
          rows = JSON.parse(text);
        } else {
          // CSV parsing
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',').map(h=>h.trim().replace(/"/g,''));
          rows = lines.slice(1).map(line=>{
            const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
            const obj = {};
            headers.forEach((h,i)=>obj[h]=vals[i]||'');
            return obj;
          });
        }
        setImported(rows.slice(0,5));
        addToast(`${rows.length} enregistrement(s) détectés. Prêt à importer.`,'info');
      } catch(err) {
        addToast('Erreur de lecture du fichier','error');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!imported.length) return;
    const now = new Date().toISOString().split('T')[0];
    const newDossiers = imported.map((row,i)=>({
      id: `IMP-${Date.now()}-${i}`,
      client: row.client || row.nom || row.name || `Client ${i+1}`,
      email: row.email || '',
      phone: row.phone || row.tel || row.telephone || '',
      address: row.address || row.adresse || '',
      dp_number: row.dp_number || row.dp || '',
      works: [{ type: row.type_travaux || row.type || 'ITE', dossier_type: row.type_dossier || 'Demande Préalable Raccordement' }],
      status: 'nouveau', assignee: EMPLOYEES[0], paid: false, amount: Number(row.amount||row.montant||0),
      created: now, updated: now, docs: [], notes: [], client_access: false, client_token: null
    }));
    setDossiers(prev=>[...newDossiers,...prev]);
    setImported([]);
    addToast(`${newDossiers.length} dossiers importés avec succès`,'success');
  };

  return (
    <div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,marginBottom:4}}>Import de données</h2>
      <p style={{color:'var(--text2)',fontSize:13,marginBottom:24}}>Importez vos anciens fichiers clients (CSV ou JSON) pour les intégrer au CRM.</p>

      <div className="card" style={{marginBottom:20}}>
        <div className="card-title" style={{marginBottom:16}}>Format CSV attendu</div>
        <code style={{display:'block',background:'var(--bg)',padding:14,borderRadius:'var(--radius2)',fontSize:12,color:'var(--accent2)',overflowX:'auto',whiteSpace:'nowrap'}}>
          client,email,phone,address,dp_number,type_travaux,type_dossier,amount
        </code>
        <p style={{fontSize:12,color:'var(--text3)',marginTop:10}}>
          Pour JSON: tableau d'objets avec les mêmes clés. Les champs manquants seront laissés vides.
        </p>
      </div>

      <div className={`upload-zone ${dragging?'dragging':''}`}
        style={{marginBottom:20}}
        onClick={()=>fileRef.current.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files);}}>
        <Icon name="import" size={40} color="var(--accent2)"/>
        <p style={{fontSize:15,fontWeight:600,marginTop:8}}>Glissez votre fichier ici</p>
        <p>CSV ou JSON · Vos anciennes données seront préservées</p>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.json" style={{display:'none'}} onChange={e=>handleFile(e.target.files)}/>

      {imported.length>0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Aperçu ({imported.length} premières lignes)</div>
            <button className="btn btn-primary" onClick={confirmImport}><Icon name="check" size={15}/>Confirmer l'import</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>{Object.keys(imported[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
              <tbody>
                {imported.map((row,i)=>(
                  <tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{v||'—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================
function AdminPage({ addToast }) {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <h2 style={{fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:800,marginBottom:20}}>Administration</h2>
      <div className="tabs">
        {['users','notifications','securite'].map(t=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='users'?'Utilisateurs':t==='notifications'?'Notifications':'Sécurité'}
          </button>
        ))}
      </div>
      {tab==='users' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{color:'var(--text2)',fontSize:13}}>{USERS.length} utilisateurs</span>
            <button className="btn btn-primary btn-sm" onClick={()=>addToast('Invitation envoyée','success')}><Icon name="plus" size={14}/>Inviter</button>
          </div>
          {USERS.map(u=>(
            <div key={u.id} className="card" style={{marginBottom:10,display:'flex',alignItems:'center',gap:14}}>
              <div className="user-avatar">{u.initials}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{u.name}</div>
                <div style={{fontSize:12,color:'var(--text2)'}}>{u.email}</div>
              </div>
              <span className="chip" style={{background:u.role==='superadmin'?'rgba(245,158,11,0.15)':'rgba(99,102,241,0.15)',color:u.role==='superadmin'?'var(--gold)':'var(--accent2)'}}>{u.role}</span>
              <button className="btn-icon" onClick={()=>addToast('Fonctionnalité disponible en version connectée','info')}><Icon name="edit" size={14}/></button>
            </div>
          ))}
          <div style={{marginTop:16,padding:14,background:'var(--bg3)',borderRadius:'var(--radius2)',fontSize:13,color:'var(--text2)'}}>
            <strong>Droits :</strong> Super Admin → tout accès. Admin → lecture/écriture sans suppression. Employé → ses dossiers uniquement.
          </div>
        </div>
      )}
      {tab==='notifications' && (
        <div className="card">
          <div className="card-title" style={{marginBottom:16}}>Configuration des notifications email</div>
          {[['Nouveau dossier créé','superadmin'],['Paiement reçu','superadmin + admin'],['Statut modifié','client + responsable'],['Nouveau document ajouté','responsable'],['Note ajoutée','équipe assignée']].map(([event,dest])=>(
            <div key={event} style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,padding:'10px 14px',background:'var(--bg3)',borderRadius:'var(--radius2)'}}>
              <Icon name="mail" size={16} color="var(--accent2)"/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600}}>{event}</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>→ {dest}</div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                <input type="checkbox" defaultChecked style={{accentColor:'var(--green)'}}/>Actif
              </label>
            </div>
          ))}
        </div>
      )}
      {tab==='securite' && (
        <div className="card">
          <div className="card-title" style={{marginBottom:16}}>Sécurité & accès</div>
          {[['Authentification 2FA','Protège les comptes admin','Actif'],['Tokens clients','Liens sécurisés à durée limitée','Actif'],['Journaux d\'accès','Traçabilité de toutes les actions','Actif'],['HTTPS forcé','Chiffrement des données en transit','Actif']].map(([t,d,s])=>(
            <div key={t} style={{display:'flex',gap:14,marginBottom:14,padding:14,background:'var(--bg3)',borderRadius:'var(--radius2)'}}>
              <Icon name="lock" size={20} color="var(--green)"/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>{t}</div>
                <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{d}</div>
              </div>
              <span className="chip" style={{background:'rgba(16,185,129,0.15)',color:'var(--green)',alignSelf:'center'}}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [dossiers, setDossiers] = useState(MOCK_DOSSIERS);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const addToast = (msg, type='info') => {
    const id = Date.now();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  };
  const removeToast = (id) => setToasts(t=>t.filter(x=>x.id!==id));

  if (!user) return (
    <>
      <style>{CSS}</style>
      <LoginPage onLogin={setUser}/>
    </>
  );

  const pages = {
    dashboard: <Dashboard dossiers={dossiers} currentUser={user}/>,
    dossiers: <DossiersPage dossiers={dossiers} setDossiers={setDossiers} currentUser={user} addToast={addToast}/>,
    clients: <ClientsPage dossiers={dossiers} addToast={addToast}/>,
    paiements: <PaiementsPage dossiers={dossiers} setDossiers={setDossiers} currentUser={user} addToast={addToast}/>,
    import: <ImportPage setDossiers={setDossiers} addToast={addToast}/>,
    admin: <AdminPage addToast={addToast}/>,
  };

  const titles = { dashboard:'Tableau de bord', dossiers:'Dossiers', clients:'Clients', paiements:'Paiements', import:'Import de données', admin:'Administration' };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar active={active} setActive={setActive} currentUser={user} onLogout={()=>setUser(null)} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} dossiers={dossiers}/>
        <div className="main">
          <div className="topbar">
            <button className="btn-icon mobile-menu-btn" onClick={()=>setSidebarOpen(o=>!o)}><Icon name="menu"/></button>
            <div className="topbar-title">{titles[active]}</div>
            <button className="btn-icon" onClick={()=>addToast('Aucune nouvelle notification','info')} style={{position:'relative'}}>
              <Icon name="bell" size={18}/>
            </button>
            <div className="user-avatar" style={{width:36,height:36,fontSize:13,cursor:'default'}} title={user.name}>{user.initials}</div>
          </div>
          <div className="content">
            {pages[active] || pages.dashboard}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast}/>
    </>
  );
}