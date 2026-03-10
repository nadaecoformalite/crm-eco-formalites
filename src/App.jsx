import { useState, useMemo, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const LOGO_SRC = "data:image/jpeg;base64,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";

const EMPLOYEES = ["Nada","Sarah","David","Jimmy","Sonia","Harry","Farah","Fabienne","Ounza","Yael","Dan"];
const WORK_TYPES = ["ITE","PAC","Panneaux Solaires","Systeme Solaire Combine","Menuiseries Exterieures","Abri Jardin","Pergola","Carport"];
const STATUSES = [
  { key:"nouveau", label:"Nouveau", color:"#6366f1" },
  { key:"en_cours", label:"En cours", color:"#E8501A" },
  { key:"en_attente", label:"En attente", color:"#7c3aed" },
  { key:"valide", label:"Valide", color:"#059669" },
  { key:"refuse", label:"Refuse", color:"#dc2626" },
  { key:"termine", label:"Termine", color:"#0891b2" },
];
const DOSSIER_TYPES = ["Demande Prealable Raccordement","CONSUEL","Recuperation TVA"];
const USERS = [
  { id:1, name:"Super Admin", email:"superadmin@crm.fr", password:"admin2024", role:"superadmin", initials:"SA" },
  { id:1, name:"Super Admin", email:"yossi@eco-formalites.com", password:"Ner1234!", role:"superadmin", initials:"Yossi" },
  { id:2, name:"Admin", email:"admin@crm.fr", password:"admin123", role:"admin", initials:"AD" },
  { id:3, name:"Admin", email:"admin4@eco-fromalites.com", password:"Ner1234!", role:"employee", initials:"Nada" },
  { id:3, name:"Admin", email:"admin2@eco-fromalites.com", password:"Ner1234!", role:"admin", initials:"Sarah" },
  { id:3, name:"Admin", email:"admin1@eco-fromalites.com", password:"Ner1234!", role:"admin", initials:"David" },
  { id:3, name:"Admin", email:"jimmyrakotobe10@gmail.com", password:"Ner1234!", role:"admin", initials:"Madagascar" },
];
const MOCK = [
  { id:"DOS-2024-001", client:"Martin Dupont", email:"martin@example.com", phone:"06 12 34 56 78", address:"12 rue des Lilas, 75011 Paris", dp_number:"DP 075 111 24 00001", works:[{type:"PAC",dossier_type:"Demande Prealable"},{type:"ITE",dossier_type:"Consuel"}], status:"en_cours", assignee:"Sarah", created:"2024-11-15", updated:"2024-12-01", paid:false, amount:1200, docs:[{name:"Devis_Martin.pdf",size:"245 KB",date:"2024-11-15"}], notes:[{author:"Sarah",date:"2024-11-20",text:"Dossier en attente de validation EDF."}], client_access:true },
  { id:"DOS-2024-002", client:"Emilie Rousseau", email:"emilie@example.com", phone:"06 98 76 54 32", address:"5 avenue Victor Hugo, 69001 Lyon", dp_number:"DP 069 011 24 00042", works:[{type:"Panneaux Solaires",dossier_type:"Recuperation TVA"}], status:"valide", assignee:"Nada", created:"2024-10-08", updated:"2024-11-30", paid:true, amount:800, docs:[{name:"Facture_Panneaux.pdf",size:"180 KB",date:"2024-10-10"}], notes:[{author:"Nada",date:"2024-11-30",text:"Dossier valide."}], client_access:false },
  { id:"DOS-2024-003", client:"Jean-Pierre Moreau", email:"jp@example.com", phone:"07 11 22 33 44", address:"28 chemin du Moulin, 13300 Salon-de-Provence", dp_number:"DP 013 055 24 00078", works:[{type:"Menuiseries Exterieures",dossier_type:"Consuel"}], status:"nouveau", assignee:"Jimmy", created:"2024-12-05", updated:"2024-12-05", paid:false, amount:2500, docs:[], notes:[], client_access:true },
];

async function extractDPFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + " ";
    }
    // Cherche le pattern N°DP : DP suivi de chiffres et espaces
    const patterns = [
      /N°DP\s*\d{3}\s*\d{3}\s*\d{2,4}\s*\d{4,6}/gi,
      /N°DP[\s\-]\d[\d\s\-]{10,25}/gi,
      /\bN°DP\s+[\d\s]{8,25}/gi,
    ];
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match[0]) {
        return match[0].trim().replace(/\s+/g, " ");
      }
    }
    return null;
  } catch (e) {
    console.error("Erreur lecture PDF:", e);
    return null;
  }
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

:root {
  --orange: #E8501A;
  --orange-light: #FEF0EB;
  --orange-dark: #c43e10;
  --bg: #F5F5F0;
  --bg2: #ffffff;
  --bg3: #FAFAF8;
  --border: #E8E8E0;
  --border2: #D0D0C8;
  --text: #1A1A16;
  --text2: #3D3D35;
  --text3: #6B6B60;
  --text4: #A0A090;
  --green: #1A7A4A;
  --green-light: #EDFAF3;
  --red: #C8260E;
  --red-light: #FEF0EE;
  --blue: #1A4A8A;
  --blue-light: #EEF3FD;
  --purple: #6B35C8;
  --purple-light: #F3EFFE;
  --teal: #0A7A8A;
  --teal-light: #EEF9FA;
  --ff: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --ff-mono: 'DM Mono', monospace;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06);
  --radius: 10px;
  --radius-lg: 14px;
* { box-sizing: border-box; margin: 0; padding: 0; }
body, html, #root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #111827;
  background: #f4f6fb;
  min-height: 100vh;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body, html, #root {
  font-family: var(--ff);
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

.app { display: flex; min-height: 100vh; }

/* ── SIDEBAR ── */
.sb {
  width: 240px;
  background: var(--text);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  z-index: 100;
  transition: transform .3s cubic-bezier(.4,0,.2,1);
}

.sb-logo {
  padding: 22px 20px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  gap: 10px;
}

.sb-logo img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.sb-nav { flex: 1; padding: 16px 10px; overflow-y: auto; }

.nav-section {
  font-size: 9px;
  font-weight: 700;
  color: rgba(255,255,255,0.3);
  letter-spacing: .12em;
  text-transform: uppercase;
  padding: 0 10px;
  margin-bottom: 6px;
  margin-top: 16px;
}
.nav-section:first-child { margin-top: 0; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.6);
  margin-bottom: 2px;
  transition: all .15s;
  border: 1px solid transparent;
  font-family: var(--ff);
}
.nav-item:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
.nav-item.active {
  background: var(--orange);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(232,80,26,0.4);
}

.nbadge {
  margin-left: auto;
  background: rgba(255,255,255,0.15);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  font-family: var(--ff);
}
.nav-item.active .nbadge { background: rgba(255,255,255,0.25); }

.sb-user {
  padding: 14px 14px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--orange);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  font-family: var(--ff);
}

/* ── MAIN ── */
.main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }

.topbar {
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  padding: 0 28px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar-title { font-size: 17px; font-weight: 700; color: var(--text); flex: 1; letter-spacing: -.02em; }

.content { padding: 28px; flex: 1; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px;
  border-radius: var(--radius);
  font-size: 13px; font-weight: 600;
  cursor: pointer; border: none;
  transition: all .15s;
  white-space: nowrap;
  font-family: var(--ff);
  letter-spacing: -.01em;
}
.btn-p { background: var(--orange); color: #fff; }
.btn-p:hover { background: var(--orange-dark); box-shadow: 0 4px 14px rgba(232,80,26,0.35); transform: translateY(-1px); }
.btn-s { background: var(--bg2); color: var(--text2); border: 1px solid var(--border); }
.btn-s:hover { background: var(--bg3); border-color: var(--border2); }
.btn-d { background: var(--red-light); color: var(--red); border: 1px solid #fcc; }
.btn-d:hover { background: #fde8e8; }
.btn-g { background: var(--green-light); color: var(--green); border: 1px solid #a7f3d0; }
.btn-g:hover { background: #d1fae5; }
.btn-sm { padding: 6px 11px; font-size: 12px; }
.bic {
  padding: 7px; border-radius: 8px;
  background: var(--bg3); border: 1px solid var(--border);
  color: var(--text3); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.bic:hover { background: var(--bg2); color: var(--text); border-color: var(--border2); box-shadow: var(--shadow); }

/* ── CARDS ── */
.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 22px;
  box-shadow: var(--shadow);
}

/* ── STAT CARDS ── */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 24px; }
.stat-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow);
  transition: box-shadow .2s, transform .2s;
}
.stat-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.stat-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--sc, var(--orange));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.stat-val { font-size: 32px; font-weight: 800; line-height: 1; margin-bottom: 5px; letter-spacing: -.04em; }
.stat-lbl { font-size: 12px; color: var(--text3); font-weight: 500; }

/* ── BADGES ── */
.sbadge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
  font-family: var(--ff);
}
.sdot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.chip {
  display: inline-block; padding: 3px 9px; border-radius: 5px;
  font-size: 11px; font-weight: 600;
  background: var(--orange-light); color: var(--orange);
  border: 1px solid rgba(232,80,26,0.2);
  white-space: nowrap;
  font-family: var(--ff);
}
.chip-d { background: var(--purple-light); color: var(--purple); border-color: rgba(107,53,200,0.2); }

.asgn {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 20px; padding: 3px 10px 3px 4px;
  font-size: 12px; font-weight: 500; color: var(--text2);
}
.asgn-av {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--orange);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff;
}

/* ── SEARCH / FILTERS ── */
.srch-wrap { position: relative; flex: 1; min-width: 200px; }
.srch {
  width: 100%; padding: 9px 14px 9px 38px;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text);
  font-size: 13px; outline: none;
  font-family: var(--ff);
  transition: all .15s;
}
.srch:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,80,26,0.1); }
.srch-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text4); pointer-events: none; }

.fsel {
  padding: 9px 12px; background: var(--bg2);
  border: 1px solid var(--border); border-radius: var(--radius);
  color: var(--text2); font-size: 12px; outline: none;
  cursor: pointer; font-family: var(--ff); font-weight: 500;
}
.fsel:focus { border-color: var(--orange); }

/* ── TABLE ── */
table { width: 100%; border-collapse: collapse; }
thead tr { border-bottom: 2px solid var(--border); }
th {
  text-align: left; padding: 10px 16px;
  font-size: 10px; font-weight: 700; color: var(--text4);
  text-transform: uppercase; letter-spacing: .1em;
  white-space: nowrap; background: var(--bg3);
  font-family: var(--ff);
}
tbody tr { border-bottom: 1px solid var(--border); cursor: pointer; transition: background .1s; }
tbody tr:hover { background: #FDFDF8; }
td { padding: 13px 16px; font-size: 13px; vertical-align: middle; color: var(--text2); }

/* ── MODAL ── */
.overlay {
  position: fixed; inset: 0;
  background: rgba(26,26,22,0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 100%; max-width: 720px;
  max-height: 92vh; overflow-y: auto;
  box-shadow: var(--shadow-lg);
}
.mhdr {
  padding: 24px 26px 18px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  position: sticky; top: 0; background: var(--bg2); z-index: 10;
}
.mbody { padding: 22px 26px; }
.mfoot {
  padding: 16px 26px;
  border-top: 1px solid var(--border);
  display: flex; gap: 10px; justify-content: flex-end;
  background: var(--bg3);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ── FORM ── */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.fg { display: flex; flex-direction: column; gap: 5px; }
.fg.full { grid-column: 1/-1; }
label { font-size: 11px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: .07em; font-family: var(--ff); }
input, select, textarea {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); color: var(--text);
  padding: 9px 12px; font-size: 13px;
  outline: none; transition: all .15s;
  width: 100%; font-family: var(--ff);
}
input:focus, select:focus, textarea:focus {
  border-color: var(--orange);
  box-shadow: 0 0 0 3px rgba(232,80,26,0.1);
}
textarea { resize: vertical; min-height: 72px; }
input[type=checkbox] { width: auto; accent-color: var(--orange); }

/* ── TABS ── */
.tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 20px; }
.tab {
  padding: 10px 18px; font-size: 13px; font-weight: 500;
  cursor: pointer; color: var(--text3);
  transition: all .15s; border: none; background: transparent;
  border-bottom: 2px solid transparent; margin-bottom: -2px;
  font-family: var(--ff);
}
.tab.active { color: var(--orange); font-weight: 700; border-bottom-color: var(--orange); }
.tab:not(.active):hover { color: var(--text); }

/* ── DOCS ── */
.doc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius); margin-bottom: 8px;
  transition: all .15s;
}
.doc-item:hover { background: var(--bg2); border-color: var(--border2); box-shadow: var(--shadow); }

.upload-z {
  border: 2px dashed var(--border2);
  border-radius: var(--radius-lg);
  padding: 32px; text-align: center;
  cursor: pointer; transition: all .2s;
  margin-bottom: 16px;
  background: var(--bg3);
}
.upload-z:hover { border-color: var(--orange); background: var(--orange-light); }

/* ── NOTES ── */
.note-item {
  padding: 14px 16px;
  background: var(--bg3);
  border-radius: var(--radius);
  border-left: 3px solid var(--orange);
  margin-bottom: 10px;
}

/* ── TOASTS ── */
.toast-c { position: fixed; bottom: 24px; right: 24px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
.toast {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex; align-items: center; gap: 10px;
  box-shadow: var(--shadow-lg);
  min-width: 260px; max-width: 360px;
  color: var(--text);
  animation: tsin .25s cubic-bezier(.4,0,.2,1);
  font-family: var(--ff);
}
@keyframes tsin { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
.toast.s { border-left: 3px solid var(--green); }
.toast.e { border-left: 3px solid var(--red); }
.toast.i { border-left: 3px solid var(--orange); }

/* ── LOGIN ── */
.login-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: var(--text);
  position: relative; overflow: hidden;
}
.login-page::before {
  content: "";
  position: absolute;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(232,80,26,0.15) 0%, transparent 70%);
  top: -100px; right: -100px;
  pointer-events: none;
}
.login-card {
  background: var(--bg2);
  border-radius: 20px;
  padding: 44px 40px;
  width: 100%; max-width: 420px;
  box-shadow: var(--shadow-lg);
  position: relative; z-index: 1;
}

/* ── MISC ── */
.emp-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.emp-track { flex: 1; background: var(--border); border-radius: 4px; height: 6px; overflow: hidden; }
.emp-fill { height: 100%; border-radius: 4px; background: var(--orange); transition: width .5s; }

.dp-detected {
  background: var(--green-light); border: 1px solid #a7f3d0;
  border-radius: var(--radius); padding: 12px 14px;
  display: flex; align-items: center; gap: 10px; margin-top: 8px;
}
.scanning { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text3); padding: 8px 0; }
.spin { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .sb { transform: translateX(-100%); }
  .sb.open { transform: translateX(0); }
  .main { margin-left: 0; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .content { padding: 16px; }
  .topbar { padding: 0 16px; }
}
`;


function SI({n,s=16,c="currentColor"}){
  const ic={
    folder:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    plus:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    search:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    users:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    settings:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    bell:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    upload:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    download:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    check:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
    x:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    edit:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    eye:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    mail:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    credit:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    bar:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    import:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    lock:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    logout:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    menu:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    msg:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    scan:<svg width={s} height={s} fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  };
  return ic[n]||null;
}

function SBadge({status}){
  const s=STATUSES.find(x=>x.key===status)||STATUSES[0];
  return <span className="sbadge" style={{background:s.color+"18",color:s.color,border:"1px solid "+s.color+"30"}}><span className="sdot" style={{background:s.color}}/>{s.label}</span>;
}

function Toasts({toasts,rm}){
  return <div className="toast-c">{toasts.map(t=>(
    <div key={t.id} className={"toast "+t.type}>
      <span style={{fontSize:15,flexShrink:0,color:t.type==="s"?"#1A7A4A":t.type==="e"?"#C8260E":"#E8501A"}}>{t.type==="s"?"✓":t.type==="e"?"✕":"ℹ"}</span>
      <span style={{flex:1,fontSize:13}}>{t.msg}</span>
      <button onClick={()=>rm(t.id)} style={{background:"none",border:"none",color:"var(--text4)",cursor:"pointer",display:"flex"}}><SI n="x" s={13}/></button>
    </div>
  ))}</div>;
}

function Login({onLogin}){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const go=()=>{const u=USERS.find(x=>x.email===email&&x.password===pw);u?onLogin(u):setErr("Email ou mot de passe incorrect.");};
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src={LOGO_SRC} alt="Eco Formalites" style={{height:50,objectFit:"contain",marginBottom:20,filter:"none"}}/>
          <p style={{color:"var(--text3)",fontSize:13,marginTop:8}}>Espace de gestion des dossiers</p>
        </div>
        {err&&<div style={{background:"var(--red-light)",border:"1px solid #fcc",borderRadius:"var(--radius)",padding:10,color:"var(--red)",fontSize:13,marginBottom:14}}>{err}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="fg"><label>Adresse email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.fr" onKeyDown={e=>e.key==="Enter"&&go()}/></div>
          <div className="fg"><label>Mot de passe</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&go()}/></div>
          <button className="btn btn-p" style={{width:"100%",justifyContent:"center",padding:13,marginTop:4,fontSize:14}} onClick={go}><SI n="lock" s={15}/>Se connecter</button>
        </div>
        <div style={{marginTop:20,padding:14,background:"var(--bg3)",borderRadius:"var(--radius)",fontSize:12,color:"var(--text3)",lineHeight:1.9,border:"1px solid var(--border)"}}>
          <strong style={{color:"var(--text2)"}}>Comptes demo :</strong><br/>
          superadmin@crm.fr / admin2024<br/>
          admin@crm.fr / admin123
        </div>
      </div>
    </div>
  );
}

function Dashboard({dossiers}){
  const total=dossiers.length;
  const enCours=dossiers.filter(d=>d.status==="en_cours").length;
  const termines=dossiers.filter(d=>d.status==="termine").length;
  const impayes=dossiers.filter(d=>!d.paid).length;
  const totalPaid=dossiers.filter(d=>d.paid).reduce((s,d)=>s+d.amount,0);
  const empDist=EMPLOYEES.map(e=>({name:e,count:dossiers.filter(d=>d.assignee===e).length})).filter(e=>e.count>0).sort((a,b)=>b.count-a.count);
  const maxEmp=Math.max(...empDist.map(e=>e.count),1);
  return (
    <div>
      <div className="stats-grid">
        {[{l:"Total dossiers",v:total,c:"var(--orange)"},{l:"En cours",v:enCours,c:"var(--orange)"},{l:"Termines",v:termines,c:"var(--green)"},{l:"Impayes",v:impayes,c:"var(--red)"}].map((s,i)=>(
          <div className="stat-card" key={i} style={{"--sc":s.c}}>
            <div className="stat-val" style={{color:s.c}}>{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card">
          <h3 style={{fontSize:13,fontWeight:700,marginBottom:16,color:"var(--text)",letterSpacing:"-.01em"}}>Repartition des statuts</h3>
          {STATUSES.map(s=>{const c=dossiers.filter(d=>d.status===s.key).length;return(
            <div key={s.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span className="sdot" style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
              <span style={{fontSize:12,flex:1,color:"var(--text2)",fontWeight:500}}>{s.label}</span>
              <div style={{flex:2,background:"var(--border)",borderRadius:4,height:6,overflow:"hidden"}}><div style={{width:(total?c/total*100:0)+"%",height:"100%",background:s.color,borderRadius:4,transition:"width .5s"}}/></div>
              <span style={{fontSize:11,color:"var(--text4)",width:18,textAlign:"right",fontWeight:700}}>{c}</span>
            </div>
          );})}
        </div>
        <div className="card">
          <h3 style={{fontSize:13,fontWeight:700,marginBottom:16,color:"var(--text)",letterSpacing:"-.01em"}}>Charge par employe</h3>
          {empDist.slice(0,7).map(e=>(
            <div className="emp-bar" key={e.name}>
              <span style={{fontSize:11,fontWeight:600,width:70,flexShrink:0,color:"var(--text2)"}}>{e.name}</span>
              <div className="emp-track"><div className="emp-fill" style={{width:(e.count/maxEmp*100)+"%"}}/></div>
              <span style={{fontSize:11,color:"var(--text4)",width:18,textAlign:"right",fontWeight:700}}>{e.count}</span>
            </div>
          ))}
          {!empDist.length&&<p style={{color:"var(--text4)",fontSize:13}}>Aucune donnee</p>}
        </div>
      </div>
      <div className="card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)",letterSpacing:"-.01em"}}>Revenus encaisses</h3>
          <span style={{fontWeight:800,fontSize:24,color:"var(--green)",letterSpacing:"-.03em"}}>{totalPaid.toLocaleString("fr-FR")} €</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {WORK_TYPES.map(wt=>{const c=dossiers.filter(d=>d.works.some(w=>w.type===wt)).length;return(
            <div key={wt} style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 16px",flex:"1",minWidth:100}}>
              <div style={{fontSize:10,color:"var(--text4)",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>{wt}</div>
              <div style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-.03em"}}>{c}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

function DossierForm({initial,onSave,onClose,currentUser}){
  const empty={client:"",email:"",phone:"",address:"",dp_number:"",works:[{type:"PAC",dossier_type:"Demande Prealable Raccordement"}],status:"nouveau",assignee:EMPLOYEES[0],paid:false,amount:0,client_access:false,notes:[],docs:[]};
  const [f,setF]=useState(initial?{...initial}:empty);
  const [scanning,setScanning]=useState(false);
  const [dpDetected,setDpDetected]=useState(null);
  const pdfRef=useRef();
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setW=(i,k,v)=>{const w=[...f.works];w[i]={...w[i],[k]:v};set("works",w);};
  const addW=()=>set("works",[...f.works,{type:"ITE",dossier_type:"Demande Prealable Raccordement"}]);
  const rmW=i=>set("works",f.works.filter((_,j)=>j!==i));
  const handlePDFScan=async(file)=>{
    if(!file||!file.name.endsWith(".pdf"))return;
    setScanning(true);setDpDetected(null);
    const dp=await extractDPFromPDF(file);
    setScanning(false);
    if(dp){setDpDetected(dp);set("dp_number",dp);}else{setDpDetected("not_found");}
  };
  const save=()=>{
    if(!f.client.trim())return;
    const now=new Date().toISOString().split("T")[0];
    const id=initial?.id||("DOS-"+new Date().getFullYear()+"-"+(Math.floor(Math.random()*900)+100));
    onSave({...f,id,created:initial?.created||now,updated:now,docs:initial?.docs||[],notes:initial?.notes||[],client_token:f.client_access?(initial?.client_token||("tok_"+Date.now())):null});
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="mhdr">
          <div>
            <h2 style={{fontSize:17,fontWeight:800,color:"var(--text)",letterSpacing:"-.02em"}}>{initial?"Modifier le dossier":"Nouveau dossier"}</h2>
            {initial&&<div style={{fontSize:11,color:"var(--orange)",marginTop:3,fontWeight:700,fontFamily:"var(--ff-mono)"}}>{initial.id}</div>}
          </div>
          <button className="bic" onClick={onClose}><SI n="x"/></button>
        </div>
        <div className="mbody">
          <div className="form-grid" style={{marginBottom:20}}>
            <div className="fg"><label>Nom complet *</label><input value={f.client} onChange={e=>set("client",e.target.value)} placeholder="Prenom Nom"/></div>
            <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
            <div className="fg"><label>Telephone</label><input value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
            <div className="fg full">
              <label>N° DP — ou scanner un PDF pour extraction auto</label>
              <div style={{display:"flex",gap:8}}>
                <input value={f.dp_number} onChange={e=>set("dp_number",e.target.value)} placeholder="DP 075 111 24 00001" style={{flex:1}}/>
                <button className="btn btn-s btn-sm" style={{flexShrink:0}} onClick={()=>pdfRef.current.click()}><SI n="scan" s={14}/>Scanner PDF</button>
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>handlePDFScan(e.target.files[0])}/>
              {scanning&&<div className="scanning"><span className="spin">⟳</span>Lecture du PDF...</div>}
              {dpDetected&&dpDetected!=="not_found"&&<div className="dp-detected"><SI n="check" s={16} c="var(--green)"/><div><div style={{fontSize:12,fontWeight:700,color:"var(--green)"}}>N° DP detecte !</div><div style={{fontSize:13,color:"var(--text)",fontWeight:600,marginTop:2,fontFamily:"var(--ff-mono)"}}>{dpDetected}</div></div></div>}
              {dpDetected==="not_found"&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"var(--radius)",padding:"10px 12px",fontSize:12,color:"#b45309",marginTop:8}}>Aucun N° DP trouve. Saisis-le manuellement.</div>}
            </div>
            <div className="fg full"><label>Adresse</label><input value={f.address} onChange={e=>set("address",e.target.value)}/></div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <p style={{fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".08em"}}>Travaux</p>
            <button className="btn btn-s btn-sm" onClick={addW}><SI n="plus" s={13}/>Ajouter</button>
          </div>
          {f.works.map((w,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:8,padding:"12px 14px",background:"var(--bg3)",borderRadius:"var(--radius)",border:"1px solid var(--border)",alignItems:"center"}}>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                <select value={w.type} onChange={e=>setW(i,"type",e.target.value)}>{WORK_TYPES.map(t=><option key={t}>{t}</option>)}</select>
                <select value={w.dossier_type} onChange={e=>setW(i,"dossier_type",e.target.value)}>{DOSSIER_TYPES.map(t=><option key={t}>{t}</option>)}</select>
              </div>
              {f.works.length>1&&<button className="bic" onClick={()=>rmW(i)}><SI n="x" s={13}/></button>}
            </div>
          ))}
          <div className="form-grid" style={{marginTop:16}}>
            <div className="fg"><label>Statut</label><select value={f.status} onChange={e=>set("status",e.target.value)}>{STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            <div className="fg"><label>Responsable</label><select value={f.assignee} onChange={e=>set("assignee",e.target.value)}>{EMPLOYEES.map(e=><option key={e}>{e}</option>)}</select></div>
            <div className="fg"><label>Montant (€)</label><input type="number" value={f.amount} onChange={e=>set("amount",Number(e.target.value))}/></div>
            <div className="fg" style={{gap:12,justifyContent:"flex-end"}}>
              <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--text2)",textTransform:"none",letterSpacing:"normal"}}><input type="checkbox" checked={f.paid} onChange={e=>set("paid",e.target.checked)}/>Paye</label>
              <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--text2)",textTransform:"none",letterSpacing:"normal"}}><input type="checkbox" checked={f.client_access} onChange={e=>set("client_access",e.target.checked)}/>Acces client</label>
            </div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-s" onClick={onClose}>Annuler</button>
          <button className="btn btn-p" onClick={save}><SI n="check" s={14}/>{initial?"Enregistrer":"Creer le dossier"}</button>
        </div>
      </div>
    </div>
  );
}

function DossierDetail({dossier,onClose,onUpdate,currentUser,toast}){
  const [tab,setTab]=useState("info");
  const [note,setNote]=useState("");
  const [editing,setEditing]=useState(false);
  const [d,setD]=useState({...dossier});
  const fRef=useRef();
  const save=(u)=>{const nd={...d,...u,updated:new Date().toISOString().split("T")[0]};setD(nd);onUpdate(nd);toast("Mis a jour","s");};
  const addNote=()=>{if(!note.trim())return;save({notes:[...d.notes,{author:currentUser.name,date:new Date().toISOString().split("T")[0],text:note}]});setNote("");};
  const handleFile=(files)=>{const newDocs=Array.from(files).map(f=>({name:f.name,size:Math.round(f.size/1024)+" KB",date:new Date().toISOString().split("T")[0]}));save({docs:[...d.docs,...newDocs]});toast(newDocs.length+" fichier(s) ajoute(s)","s");};
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:820}}>
        <div className="mhdr">
          <div>
            <div style={{fontSize:11,color:"var(--orange)",fontWeight:700,marginBottom:4,fontFamily:"var(--ff-mono)",letterSpacing:".05em"}}>{d.id}</div>
            <h2 style={{fontSize:20,fontWeight:800,color:"var(--text)",letterSpacing:"-.03em"}}>{d.client}</h2>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>{d.address}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            {currentUser.role!=="employee"&&<button className="btn btn-s btn-sm" onClick={()=>setEditing(true)}><SI n="edit" s={13}/>Modifier</button>}
            <button className="bic" onClick={onClose}><SI n="x"/></button>
          </div>
        </div>
        <div style={{padding:"0 26px",borderBottom:"1px solid var(--border)"}}>
          <div className="tabs" style={{borderBottom:"none"}}>
            {["info","documents","notes","paiement"].map(t=>(
              <button key={t} className={"tab"+(tab===t?" active":"")} onClick={()=>setTab(t)}>
                {t==="info"?"Informations":t==="documents"?"Documents":t==="notes"?"Notes":"Paiement"}
              </button>
            ))}
          </div>
        </div>
        <div className="mbody">
          {tab==="info"&&(
            <div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
                <SBadge status={d.status}/>
                <span className="asgn"><span className="asgn-av">{d.assignee[0]}</span>{d.assignee}</span>
                {d.client_access&&<span className="chip">Acces client actif</span>}
                {d.paid&&<span style={{color:"var(--green)",fontSize:12,fontWeight:700,background:"var(--green-light)",padding:"4px 10px",borderRadius:20,border:"1px solid #a7f3d0",display:"inline-flex",alignItems:"center",gap:4}}><SI n="check" s={12} c="var(--green)"/>Paye</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                <div>{[["Email",d.email],["Telephone",d.phone],["Adresse",d.address],["N° DP",d.dp_number]].map(([l,v])=>(
                  <div key={l} style={{marginBottom:16}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:14,color:"var(--text)",fontWeight:500,fontFamily:l==="N° DP"?"var(--ff-mono)":"var(--ff)"}}>{v||"—"}</div>
                  </div>
                ))}</div>
                <div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:10,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Travaux</div>
                    {d.works.map((w,i)=><div key={i} style={{marginBottom:7}}><span className="chip" style={{marginRight:5}}>{w.type}</span><span className="chip chip-d">{w.dossier_type}</span></div>)}
                  </div>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--text4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>Montant</div>
                  <div style={{fontSize:26,fontWeight:800,color:d.paid?"var(--green)":"var(--orange)",letterSpacing:"-.04em"}}>{d.amount.toLocaleString("fr-FR")} €</div>
                </div>
              </div>
            </div>
          )}
          {tab==="documents"&&(
            <div>
              <div className="upload-z" onClick={()=>fRef.current.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--orange)";}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handleFile(e.dataTransfer.files);}}>
                <SI n="upload" s={32} c="var(--orange)"/>
                <p style={{color:"var(--text2)",marginTop:10,fontSize:14,fontWeight:600}}>Glisser-deposer ou cliquer pour ajouter</p>
                <p style={{color:"var(--text4)",fontSize:12,marginTop:4}}>PDF, JPG, PNG, DOCX...</p>
              </div>
              <input ref={fRef} type="file" multiple style={{display:"none"}} onChange={e=>handleFile(e.target.files)}/>
              {!d.docs.length&&<p style={{color:"var(--text4)",fontSize:13,textAlign:"center",padding:28}}>Aucun document joint</p>}
              {d.docs.map((doc,i)=>(
                <div className="doc-item" key={i}>
                  <div style={{width:38,height:38,background:"var(--orange-light)",borderRadius:"var(--radius)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><SI n="download" s={17} c="var(--orange)"/></div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{doc.name}</div><div style={{fontSize:11,color:"var(--text4)",marginTop:2}}>{doc.size} · {doc.date}</div></div>
                  <button className="btn btn-s btn-sm" onClick={()=>toast("Telechargement : "+doc.name,"i")}><SI n="download" s={12}/>DL</button>
                  <button className="btn btn-d btn-sm" onClick={()=>save({docs:d.docs.filter((_,j)=>j!==i)})}><SI n="trash" s={12}/></button>
                </div>
              ))}
            </div>
          )}
          {tab==="notes"&&(
            <div>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ajouter une note ou un commentaire..." style={{flex:1,minHeight:72,color:"var(--text)"}}/>
                <button className="btn btn-p" style={{alignSelf:"flex-end"}} onClick={addNote}><SI n="msg" s={14}/>Envoyer</button>
              </div>
              {[...d.notes].reverse().map((n,i)=>(
                <div className="note-item" key={i}>
                  <div style={{fontSize:11,color:"var(--text4)",marginBottom:6,display:"flex",gap:10}}><strong style={{color:"var(--orange)"}}>{n.author}</strong><span>{n.date}</span></div>
                  <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.65}}>{n.text}</div>
                </div>
              ))}
              {!d.notes.length&&<p style={{color:"var(--text4)",fontSize:13,textAlign:"center",padding:24}}>Aucune note</p>}
            </div>
          )}
          {tab==="paiement"&&(
            <div>
              <div style={{background:d.paid?"var(--green-light)":"#fffbeb",border:"1px solid "+(d.paid?"#a7f3d0":"#fcd34d"),borderRadius:"var(--radius-lg)",padding:20,display:"flex",alignItems:"center",gap:20,marginBottom:20,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--text3)",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Montant du dossier</div>
                  <div style={{fontWeight:800,fontSize:32,color:d.paid?"var(--green)":"var(--orange)",letterSpacing:"-.04em"}}>{d.amount.toLocaleString("fr-FR")} €</div>
                  <div style={{marginTop:10}}><SBadge status={d.paid?"valide":"en_attente"}/></div>
                </div>
                {!d.paid&&<button className="btn btn-p" onClick={()=>toast("Lien de paiement envoye a "+d.client,"i")}><SI n="mail" s={14}/>Envoyer lien client</button>}
              </div>
              {currentUser.role==="superadmin"&&(
                <div style={{display:"flex",gap:10}}>
                  <button className="btn btn-g" disabled={d.paid} style={{opacity:d.paid?.5:1}} onClick={()=>{save({paid:true});toast("Paiement valide !","s");}}><SI n="check" s={14}/>Marquer comme paye</button>
                  <button className="btn btn-d" disabled={!d.paid} style={{opacity:!d.paid?.5:1}} onClick={()=>save({paid:false})}>Annuler le paiement</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editing&&<DossierForm initial={d} onSave={u=>{setD(u);onUpdate(u);setEditing(false);toast("Dossier modifie","s");}} onClose={()=>setEditing(false)} currentUser={currentUser}/>}
    </div>
  );
}

function Dossiers({dossiers,setDossiers,currentUser,toast}){
  const [q,setQ]=useState("");
  const [fSt,setFSt]=useState("all");
  const [fAs,setFAs]=useState("all");
  const [fWk,setFWk]=useState("all");
  const [creating,setCreating]=useState(false);
  const [sel,setSel]=useState(null);
  const filtered=useMemo(()=>dossiers.filter(d=>{
    const lq=q.toLowerCase();
    return(!q||d.client.toLowerCase().includes(lq)||d.address.toLowerCase().includes(lq)||d.dp_number.toLowerCase().includes(lq)||d.email.toLowerCase().includes(lq))
      &&(fSt==="all"||d.status===fSt)&&(fAs==="all"||d.assignee===fAs)&&(fWk==="all"||d.works.some(w=>w.type===fWk));
  }),[dossiers,q,fSt,fAs,fWk]);
  const create=d=>{setDossiers(p=>[d,...p]);setCreating(false);toast("Dossier cree avec succes","s");};
  const upd=d=>{setDossiers(p=>p.map(x=>x.id===d.id?d:x));setSel(d);};
  const del=id=>{setDossiers(p=>p.filter(x=>x.id!==id));setSel(null);toast("Dossier supprime","i");};
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:"var(--text)",letterSpacing:"-.03em"}}>Dossiers</h2>
          <p style={{color:"var(--text3)",fontSize:12,marginTop:3}}>{filtered.length} resultat(s) sur {dossiers.length} dossiers</p>
        </div>
        {currentUser.role!=="employee"&&<button className="btn btn-p" onClick={()=>setCreating(true)}><SI n="plus" s={15}/>Nouveau dossier</button>}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <div className="srch-wrap"><span className="srch-ico"><SI n="search" s={15}/></span><input className="srch" placeholder="Nom, adresse, n° DP..." value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="fsel" value={fSt} onChange={e=>setFSt(e.target.value)}><option value="all">Tous statuts</option>{STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <select className="fsel" value={fAs} onChange={e=>setFAs(e.target.value)}><option value="all">Tous responsables</option>{EMPLOYEES.map(e=><option key={e}>{e}</option>)}</select>
        <select className="fsel" value={fWk} onChange={e=>setFWk(e.target.value)}><option value="all">Tous travaux</option>{WORK_TYPES.map(t=><option key={t}>{t}</option>)}</select>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>ID</th><th>Client</th><th>Adresse</th><th>Travaux</th><th>Responsable</th><th>Statut</th><th>Paiement</th><th></th></tr></thead>
            <tbody>
              {!filtered.length&&<tr><td colSpan={8} style={{textAlign:"center",padding:40,color:"var(--text4)"}}>Aucun resultat</td></tr>}
              {filtered.map(d=>(
                <tr key={d.id} onClick={()=>setSel(d)}>
                  <td style={{fontWeight:600,fontSize:12,color:"var(--orange)",fontFamily:"var(--ff-mono)"}}>{d.id}</td>
                  <td style={{fontWeight:700,color:"var(--text)"}}>{d.client}</td>
                  <td style={{color:"var(--text3)",fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.address}</td>
                  <td><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{d.works.map((w,i)=><span key={i} className="chip">{w.type}</span>)}</div></td>
                  <td><span className="asgn"><span className="asgn-av">{d.assignee[0]}</span>{d.assignee}</span></td>
                  <td><SBadge status={d.status}/></td>
                  <td><span style={{color:d.paid?"var(--green)":"var(--text4)",fontSize:12,fontWeight:600}}>{d.paid?"✓ Paye":"En attente"}</span></td>
                  <td onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5}}>
                      <button className="bic" onClick={()=>setSel(d)}><SI n="eye" s={13}/></button>
                      {currentUser.role==="superadmin"&&<button className="bic" style={{color:"var(--red)"}} onClick={()=>del(d.id)}><SI n="trash" s={13}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creating&&<DossierForm onSave={create} onClose={()=>setCreating(false)} currentUser={currentUser}/>}
      {sel&&<DossierDetail dossier={sel} onClose={()=>setSel(null)} onUpdate={upd} currentUser={currentUser} toast={toast}/>}
    </div>
  );
}

function Clients({dossiers,toast}){
  const [q,setQ]=useState("");
  const clients=useMemo(()=>{
    const m={};
    dossiers.forEach(d=>{if(!m[d.email])m[d.email]={...d,count:0};m[d.email].count++;});
    return Object.values(m).filter(c=>!q||c.client.toLowerCase().includes(q.toLowerCase())||c.address.toLowerCase().includes(q.toLowerCase()));
  },[dossiers,q]);
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"var(--text)",marginBottom:4,letterSpacing:"-.03em"}}>Clients</h2>
      <p style={{color:"var(--text3)",fontSize:12,marginBottom:18}}>{clients.length} client(s) enregistre(s)</p>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <div className="srch-wrap"><span className="srch-ico"><SI n="search" s={15}/></span><input className="srch" placeholder="Nom, email, adresse..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {clients.map(c=>(
          <div className="card" key={c.email} style={{transition:"box-shadow .2s,transform .2s",cursor:"default"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--shadow-md)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--shadow)";e.currentTarget.style.transform="";}}>
            <div style={{display:"flex",gap:12,marginBottom:14,alignItems:"flex-start"}}>
              <div className="avatar" style={{width:46,height:46,fontSize:16,flexShrink:0,borderRadius:12}}>{c.client[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15,color:"var(--text)",letterSpacing:"-.01em"}}>{c.client}</div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{c.email}</div>
              </div>
              <span style={{background:"var(--orange-light)",color:"var(--orange)",padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid rgba(232,80,26,0.2)",flexShrink:0}}>{c.count} dossier{c.count>1?"s":""}</span>
            </div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:4}}>{c.phone}</div>
            <div style={{fontSize:12,color:"var(--text2)",marginBottom:16,lineHeight:1.5}}>{c.address}</div>
            <button className="btn btn-s btn-sm" onClick={()=>toast("Email envoye a "+c.client,"s")}><SI n="mail" s={12}/>Envoyer email</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Paiements({dossiers,setDossiers,currentUser,toast}){
  const unpaid=dossiers.filter(d=>!d.paid);
  const paid=dossiers.filter(d=>d.paid);
  const mark=id=>{setDossiers(p=>p.map(d=>d.id===id?{...d,paid:true}:d));toast("Paiement valide avec succes !","s");};
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"var(--text)",marginBottom:20,letterSpacing:"-.03em"}}>Paiements</h2>
      <div className="stats-grid" style={{marginBottom:22}}>
        {[
          {l:"Total encaisse",v:paid.reduce((s,d)=>s+d.amount,0).toLocaleString("fr-FR")+" €",c:"var(--green)"},
          {l:"En attente",v:unpaid.reduce((s,d)=>s+d.amount,0).toLocaleString("fr-FR")+" €",c:"var(--orange)"},
          {l:"Dossiers payes",v:paid.length,c:"var(--blue)"},
          {l:"Dossiers impayes",v:unpaid.length,c:"var(--red)"},
        ].map((s,i)=>(
          <div className="stat-card" key={i} style={{"--sc":s.c}}>
            <div className="stat-val" style={{color:s.c,fontSize:typeof s.v==="string"?20:32}}>{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:16,letterSpacing:"-.01em"}}>En attente de paiement</h3>
        {!unpaid.length&&<p style={{color:"var(--text4)",fontSize:13}}>Tous les dossiers sont regles 🎉</p>}
        {unpaid.map(d=>(
          <div key={d.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontWeight:700,color:"var(--text)",fontSize:14}}>{d.client}</div>
              <div style={{fontSize:11,color:"var(--text4)",marginTop:3,fontFamily:"var(--ff-mono)"}}>{d.id} · {d.assignee}</div>
            </div>
            <div style={{fontWeight:800,fontSize:20,color:"var(--orange)",letterSpacing:"-.03em"}}>{d.amount.toLocaleString("fr-FR")} €</div>
            <button className="btn btn-s btn-sm" onClick={()=>toast("Lien envoye a "+d.client,"i")}><SI n="mail" s={12}/>Lien paiement</button>
            {currentUser.role==="superadmin"&&<button className="btn btn-g btn-sm" onClick={()=>mark(d.id)}><SI n="check" s={12}/>Valider</button>}
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:16,letterSpacing:"-.01em"}}>Paiements recus</h3>
        {paid.map(d=>(
          <div key={d.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:"var(--text)"}}>{d.client}</div>
              <div style={{fontSize:11,color:"var(--text4)",marginTop:2,fontFamily:"var(--ff-mono)"}}>{d.id}</div>
            </div>
            <div style={{fontWeight:700,fontSize:16,color:"var(--green)"}}>{d.amount.toLocaleString("fr-FR")} €</div>
            <span style={{color:"var(--green)",fontSize:11,fontWeight:700,background:"var(--green-light)",padding:"4px 12px",borderRadius:20,border:"1px solid #a7f3d0"}}>✓ Paye</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Import({setDossiers,toast}){
  const [preview,setPreview]=useState([]);
  const fRef=useRef();
  const handle=(files)=>{
    const file=files[0];if(!file)return;
    const r=new FileReader();
    r.onload=e=>{
      try{
        let rows=[];
        if(file.name.endsWith(".json"))rows=JSON.parse(e.target.result);
        else{const lines=e.target.result.trim().split("\n");const hdrs=lines[0].split(",").map(h=>h.trim().replace(/"/g,""));rows=lines.slice(1).map(l=>{const v=l.split(",").map(x=>x.trim().replace(/"/g,""));const o={};hdrs.forEach((h,i)=>o[h]=v[i]||"");return o;});}
        setPreview(rows.slice(0,5));toast(rows.length+" enregistrements detectes","i");
      }catch{toast("Erreur de lecture du fichier","e");}
    };r.readAsText(file);
  };
  const confirm=()=>{
    const now=new Date().toISOString().split("T")[0];
    const nd=preview.map((row,i)=>({id:"IMP-"+Date.now()+"-"+i,client:row.client||row.nom||("Client "+(i+1)),email:row.email||"",phone:row.phone||row.tel||"",address:row.address||row.adresse||"",dp_number:row.dp_number||"",works:[{type:row.type_travaux||"ITE",dossier_type:"Demande Prealable Raccordement"}],status:"nouveau",assignee:EMPLOYEES[0],paid:false,amount:Number(row.amount||0),created:now,updated:now,docs:[],notes:[],client_access:false,client_token:null}));
    setDossiers(p=>[...nd,...p]);setPreview([]);toast(nd.length+" dossiers importes avec succes","s");
  };
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"var(--text)",marginBottom:4,letterSpacing:"-.03em"}}>Import de donnees</h2>
      <p style={{color:"var(--text3)",fontSize:13,marginBottom:22}}>Importez vos anciens fichiers clients au format CSV ou JSON.</p>
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{fontSize:12,fontWeight:700,color:"var(--text)",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Format CSV attendu</h3>
        <code style={{display:"block",background:"var(--bg3)",padding:14,borderRadius:"var(--radius)",fontSize:12,color:"var(--orange)",overflowX:"auto",border:"1px solid var(--border)",fontFamily:"var(--ff-mono)"}}>client,email,phone,address,dp_number,type_travaux,type_dossier,amount</code>
      </div>
      <div className="upload-z" onClick={()=>fRef.current.click()}
        onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--orange)";}}
        onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
        onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handle(e.dataTransfer.files);}}>
        <SI n="import" s={38} c="var(--orange)"/>
        <p style={{fontSize:15,fontWeight:700,marginTop:12,color:"var(--text)",letterSpacing:"-.01em"}}>Glissez votre fichier ici</p>
        <p style={{fontSize:12,color:"var(--text4)",marginTop:5}}>CSV ou JSON acceptes</p>
      </div>
      <input ref={fRef} type="file" accept=".csv,.json" style={{display:"none"}} onChange={e=>handle(e.target.files)}/>
      {preview.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Apercu ({preview.length} lignes)</h3>
            <button className="btn btn-p" onClick={confirm}><SI n="check" s={14}/>Confirmer l import</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table><thead><tr>{Object.keys(preview[0]).map(k=><th key={k}>{k}</th>)}</tr></thead>
            <tbody>{preview.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{v||"—"}</td>)}</tr>)}</tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}

function Admin({toast}){
  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:"var(--text)",marginBottom:22,letterSpacing:"-.03em"}}>Administration</h2>
      <div className="card" style={{marginBottom:14}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:16}}>Utilisateurs</h3>
        {USERS.map(u=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"13px 16px",background:"var(--bg3)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
            <div className="avatar">{u.initials}</div>
            <div style={{flex:1}}><div style={{fontWeight:600,color:"var(--text)"}}>{u.name}</div><div style={{fontSize:11,color:"var(--text4)",marginTop:2}}>{u.email}</div></div>
            <span style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,background:u.role==="superadmin"?"#fffbeb":"var(--orange-light)",color:u.role==="superadmin"?"#b45309":"var(--orange)",border:"1px solid "+(u.role==="superadmin"?"#fcd34d":"rgba(232,80,26,0.2)")}}>{u.role}</span>
          </div>
        ))}
        <button className="btn btn-p btn-sm" style={{marginTop:10}} onClick={()=>toast("Invitation envoyee","s")}><SI n="plus" s={13}/>Inviter un utilisateur</button>
      </div>
      <div className="card">
        <h3 style={{fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:16}}>Securite & acces</h3>
        {[["2FA active","Protege tous les comptes"],["Tokens clients","Liens d acces securises"],["HTTPS force","Chiffrement en transit"],["Journaux d acces","Tracabilite complete"]].map(([t,d])=>(
          <div key={t} style={{display:"flex",gap:12,alignItems:"center",marginBottom:10,padding:"12px 14px",background:"var(--bg3)",borderRadius:"var(--radius)",border:"1px solid var(--border)"}}>
            <SI n="lock" s={16} c="var(--green)"/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{t}</div><div style={{fontSize:11,color:"var(--text4)",marginTop:1}}>{d}</div></div>
            <span style={{color:"var(--green)",fontSize:11,fontWeight:700,background:"var(--green-light)",padding:"3px 10px",borderRadius:20,border:"1px solid #a7f3d0"}}>Actif</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [dossiers,setDossiers]=useState(MOCK);
  const [toasts,setToasts]=useState([]);
  const [sbOpen,setSbOpen]=useState(false);
  const toast=(msg,type="i")=>{const id=Date.now()+Math.random();setToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);};
  const rmToast=id=>setToasts(t=>t.filter(x=>x.id!==id));
  if(!user)return <><style>{css}</style><Login onLogin={u=>{setUser(u);setPage("dashboard");}}/><Toasts toasts={toasts} rm={rmToast}/></>;
  const nav=[
    {id:"dashboard",icon:"bar",label:"Dashboard"},
    {id:"dossiers",icon:"folder",label:"Dossiers",badge:dossiers.length},
    {id:"clients",icon:"users",label:"Clients"},
    {id:"paiements",icon:"credit",label:"Paiements",badge:dossiers.filter(d=>!d.paid).length},
    {id:"import",icon:"import",label:"Import"},
    ...(user.role==="superadmin"?[{id:"admin",icon:"settings",label:"Administration"}]:[]),
  ];
  const pages={
    dashboard:<Dashboard dossiers={dossiers}/>,
    dossiers:<Dossiers dossiers={dossiers} setDossiers={setDossiers} currentUser={user} toast={toast}/>,
    clients:<Clients dossiers={dossiers} toast={toast}/>,
    paiements:<Paiements dossiers={dossiers} setDossiers={setDossiers} currentUser={user} toast={toast}/>,
    import:<Import setDossiers={setDossiers} toast={toast}/>,
    admin:<Admin toast={toast}/>,
  };
  const titles={dashboard:"Tableau de bord",dossiers:"Dossiers",clients:"Clients",paiements:"Paiements",import:"Import",admin:"Administration"};
  return (
    <>
      <style>{css}</style>
      <div className="app">
        {sbOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:99}} onClick={()=>setSbOpen(false)}/>}
        <div className={"sb"+(sbOpen?" open":"")}>
          <div className="sb-logo">
            <img src={LOGO_SRC} alt="Eco Formalites" style={{height:38,objectFit:"contain"}}/>
          </div>
          <div className="sb-nav">
            <div className="nav-section">Navigation</div>
            {nav.map(item=>(
              <div key={item.id} className={"nav-item"+(page===item.id?" active":"")} onClick={()=>{setPage(item.id);setSbOpen(false);}}>
                <SI n={item.icon} s={16} c={page===item.id?"#fff":"rgba(255,255,255,0.5)"}/>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge>0&&<span className="nbadge">{item.badge}</span>}
              </div>
            ))}
          </div>
          <div className="sb-user">
            <div className="avatar" style={{fontSize:11}}>{user.initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.9)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".06em",marginTop:1}}>{user.role}</div>
            </div>
            <button style={{background:"none",border:"none",cursor:"pointer",padding:6,color:"rgba(255,255,255,0.4)",display:"flex",borderRadius:6,transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.8)"} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.4)"} onClick={()=>setUser(null)}><SI n="logout" s={15}/></button>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <button className="bic" style={{display:"none"}} onClick={()=>setSbOpen(o=>!o)}><SI n="menu" c="var(--text2)"/></button>
            <div className="topbar-title">{titles[page]}</div>
            <button className="bic" onClick={()=>toast("Aucune nouvelle notification","i")}><SI n="bell" s={17} c="var(--text3)"/></button>
            <div className="avatar" style={{width:33,height:33,fontSize:11,cursor:"default",flexShrink:0}}>{user.initials}</div>
          </div>
          <div className="content">{pages[page]||pages.dashboard}</div>
        </div>
      </div>
      <Toasts toasts={toasts} rm={rmToast}/>
    </>
  );
}