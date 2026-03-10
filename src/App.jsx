import { useState, useMemo, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const EMPLOYEES = ["Nada","Sarah","David","Jimmy","Sonia","Harry","Farah","Fabienne","Ounza","Yael"];
const WORK_TYPES = ["Panneaux Solaires","ITE","PAC","Systeme Solaire Combine","Menuiseries Exterieures","Abri Jardin","Pergola","Carport"];
const STATUSES = [
  { key:"nouveau", label:"Nouveau", color:"#6366f1" },
  { key:"en_cours", label:"En cours", color:"#d97706" },
  { key:"en_attente", label:"En attente", color:"#7c3aed" },
  { key:"valide", label:"Valide", color:"#059669" },
  { key:"refuse", label:"Refuse", color:"#dc2626" },
  { key:"termine", label:"Termine", color:"#0891b2" },
];
const DOSSIER_TYPES = ["Demande Prealable","Raccordement","Consuel","Recuperation TVA"];
const USERS = [
  { id:1, name:"Super Admin", email:"superadmin@crm.fr", password:"admin2024", role:"superadmin", initials:"SA" },
  { id:2, name:"Admin", email:"admin@crm.fr", password:"admin123", role:"admin", initials:"AD" },
  { id:3, name:"Sarah", email:"sarah@crm.fr", password:"sarah123", role:"employee", initials:"SR" },
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
    // Cherche le pattern DP : DP suivi de chiffres et espaces
    const patterns = [
      /DP\s*\d{3}\s*\d{3}\s*\d{2,4}\s*\d{4,6}/gi,
      /DP[\s\-]\d[\d\s\-]{10,25}/gi,
      /\bDP\s+[\d\s]{8,25}/gi,
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
* { box-sizing: border-box; margin: 0; padding: 0; }
body, html, #root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  color: #111827;
  background: #f4f6fb;
  min-height: 100vh;
}
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #f1f1f1; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.app { display: flex; min-height: 100vh; }
.sb { width: 230px; background: #fff; border-right: 1px solid #e2e6f0; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; transition: transform .25s; }
.sb-logo { padding: 20px 18px 16px; border-bottom: 1px solid #e2e6f0; display: flex; align-items: center; gap: 10px; }
.logo-icon { width: 36px; height: 36px; background: #4f46e5; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.logo-name { font-size: 17px; font-weight: 800; color: #111827; }
.logo-sub { font-size: 10px; color: #6b7280; letter-spacing: .1em; text-transform: uppercase; }
.sb-nav { flex: 1; padding: 14px 10px; overflow-y: auto; }
.nav-lbl { font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: .1em; text-transform: uppercase; padding: 0 8px; margin-bottom: 6px; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 2px; transition: all .15s; border: 1px solid transparent; }
.nav-item:hover { background: #f8f9fc; color: #111827; }
.nav-item.active { background: #eef2ff; color: #4f46e5; border-color: #c7d2fe; font-weight: 600; }
.nbadge { margin-left: auto; background: #4f46e5; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
.sb-user { padding: 14px 12px; border-top: 1px solid #e2e6f0; display: flex; align-items: center; gap: 9px; }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
.main { margin-left: 230px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { background: #fff; border-bottom: 1px solid #e2e6f0; padding: 0 24px; height: 58px; display: flex; align-items: center; gap: 14px; position: sticky; top: 0; z-index: 50; }
.topbar-title { font-size: 18px; font-weight: 800; color: #111827; flex: 1; }
.content { padding: 24px; flex: 1; }
.btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; white-space: nowrap; font-family: inherit; }
.btn-p { background: #4f46e5; color: #fff; }
.btn-p:hover { background: #4338ca; box-shadow: 0 4px 12px rgba(79,70,229,.3); }
.btn-s { background: #fff; color: #374151; border: 1px solid #e2e6f0; }
.btn-s:hover { background: #f8f9fc; }
.btn-d { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.btn-g { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
.btn-sm { padding: 6px 11px; font-size: 12px; }
.bic { padding: 7px; border-radius: 7px; background: #f8f9fc; border: 1px solid #e2e6f0; color: #6b7280; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all .15s; }
.bic:hover { background: #eef0f6; color: #111827; }
.card { background: #fff; border: 1px solid #e2e6f0; border-radius: 12px; padding: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 22px; }
.stat-card { background: #fff; border: 1px solid #e2e6f0; border-radius: 12px; padding: 18px; position: relative; overflow: hidden; }
.stat-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--sc, #4f46e5); }
.stat-val { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 4px; color: #111827; }
.stat-lbl { font-size: 12px; color: #6b7280; font-weight: 500; }
.sbadge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.sdot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.chip { display: inline-block; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; white-space: nowrap; }
.chip-d { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.asgn { display: inline-flex; align-items: center; gap: 5px; background: #f8f9fc; border: 1px solid #e2e6f0; border-radius: 20px; padding: 3px 10px 3px 4px; font-size: 12px; font-weight: 500; color: #374151; }
.asgn-av { width: 20px; height: 20px; border-radius: 50%; background: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; }
.srch-wrap { position: relative; flex: 1; min-width: 200px; }
.srch { width: 100%; padding: 9px 14px 9px 38px; background: #fff; border: 1px solid #e2e6f0; border-radius: 8px; color: #111827; font-size: 13px; outline: none; font-family: inherit; }
.srch:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
.srch-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
.fsel { padding: 9px 12px; background: #fff; border: 1px solid #e2e6f0; border-radius: 8px; color: #374151; font-size: 12px; outline: none; cursor: pointer; font-family: inherit; }
table { width: 100%; border-collapse: collapse; }
thead tr { border-bottom: 2px solid #e2e6f0; }
th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .07em; white-space: nowrap; background: #f8f9fc; }
tbody tr { border-bottom: 1px solid #e2e6f0; cursor: pointer; transition: background .1s; }
tbody tr:hover { background: #fafbff; }
td { padding: 13px 14px; font-size: 13px; vertical-align: middle; color: #374151; }
.overlay { position: fixed; inset: 0; background: rgba(17,24,39,.45); backdrop-filter: blur(3px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: #fff; border: 1px solid #e2e6f0; border-radius: 14px; width: 100%; max-width: 720px; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
.mhdr { padding: 22px 24px 18px; border-bottom: 1px solid #e2e6f0; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; position: sticky; top: 0; background: #fff; z-index: 10; }
.mbody { padding: 20px 24px; }
.mfoot { padding: 16px 24px; border-top: 1px solid #e2e6f0; display: flex; gap: 10px; justify-content: flex-end; background: #fafbfc; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fg { display: flex; flex-direction: column; gap: 5px; }
.fg.full { grid-column: 1/-1; }
label { font-size: 12px; font-weight: 600; color: #374151; font-family: inherit; }
input, select, textarea { background: #fff; border: 1px solid #e2e6f0; border-radius: 7px; color: #111827; padding: 9px 12px; font-size: 13px; outline: none; transition: all .15s; width: 100%; font-family: inherit; }
input:focus, select:focus, textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
textarea { resize: vertical; min-height: 72px; }
input[type=checkbox] { width: auto; accent-color: #4f46e5; }
.tabs { display: flex; gap: 2px; border-bottom: 2px solid #e2e6f0; margin-bottom: 18px; }
.tab { padding: 9px 16px; font-size: 13px; font-weight: 500; cursor: pointer; color: #6b7280; transition: all .15s; border: none; background: transparent; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: inherit; }
.tab.active { color: #4f46e5; font-weight: 700; border-bottom-color: #4f46e5; }
.doc-item { display: flex; align-items: center; gap: 10px; padding: 11px 14px; background: #f8f9fc; border: 1px solid #e2e6f0; border-radius: 8px; margin-bottom: 7px; transition: all .15s; }
.doc-item:hover { background: #fff; border-color: #c7cfe0; }
.upload-z { border: 2px dashed #c7cfe0; border-radius: 10px; padding: 28px; text-align: center; cursor: pointer; transition: all .2s; margin-bottom: 14px; background: #f8f9fc; }
.upload-z:hover { border-color: #4f46e5; background: #eef2ff; }
.note-item { padding: 12px 14px; background: #f8f9fc; border-radius: 8px; border-left: 3px solid #4f46e5; margin-bottom: 9px; }
.toast-c { position: fixed; bottom: 20px; right: 20px; z-index: 999; display: flex; flex-direction: column; gap: 7px; }
.toast { background: #fff; border: 1px solid #e2e6f0; border-radius: 10px; padding: 13px 16px; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 260px; color: #111827; animation: tsin .25s ease; }
@keyframes tsin { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
.toast.s { border-left: 4px solid #059669; }
.toast.e { border-left: 4px solid #dc2626; }
.toast.i { border-left: 4px solid #4f46e5; }
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%); }
.login-card { background: #fff; border: 1px solid #e2e6f0; border-radius: 16px; padding: 40px 36px; width: 100%; max-width: 400px; box-shadow: 0 8px 40px rgba(79,70,229,.1); }
.emp-bar { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.emp-track { flex: 1; background: #eef0f6; border-radius: 4px; height: 7px; overflow: hidden; }
.emp-fill { height: 100%; border-radius: 4px; background: #4f46e5; }
.dp-detected { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.scanning { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; padding: 8px 0; }
.spin { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .sb { transform: translateX(-100%); }
  .sb.open { transform: translateX(0); }
  .main { margin-left: 0; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .content { padding: 14px; }
  .topbar { padding: 0 14px; }
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
  return ic[n] || null;
}

function SBadge({status}){
  const s = STATUSES.find(x => x.key === status) || STATUSES[0];
  return (
    <span className="sbadge" style={{background: s.color+"18", color: s.color, border: "1px solid "+s.color+"40"}}>
      <span className="sdot" style={{background: s.color}}/>{s.label}
    </span>
  );
}

function Toasts({toasts, rm}){
  return (
    <div className="toast-c">
      {toasts.map(t => (
        <div key={t.id} className={"toast "+t.type}>
          <span style={{fontSize:16,flexShrink:0,color:t.type==="s"?"#059669":t.type==="e"?"#dc2626":"#4f46e5"}}>
            {t.type==="s"?"✓":t.type==="e"?"✕":"ℹ"}
          </span>
          <span style={{flex:1,fontSize:13,color:"#111827"}}>{t.msg}</span>
          <button onClick={()=>rm(t.id)} style={{background:"none",border:"none",color:"#9ca3af",cursor:"pointer",display:"flex"}}><SI n="x" s={13}/></button>
        </div>
      ))}
    </div>
  );
}

function Login({onLogin}){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const go=()=>{
    const u=USERS.find(x=>x.email===email&&x.password===pw);
    u?onLogin(u):setErr("Email ou mot de passe incorrect.");
  };
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:52,height:52,background:"#4f46e5",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:24}}>☀️</div>
          <h1 style={{fontSize:24,fontWeight:800,color:"#111827",marginBottom:6}}>SolarCRM Pro</h1>
          <p style={{color:"#6b7280",fontSize:13}}>Gestion des dossiers energetiques</p>
        </div>
        {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:10,color:"#dc2626",fontSize:13,marginBottom:14}}>{err}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div className="fg"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.fr" onKeyDown={e=>e.key==="Enter"&&go()}/></div>
          <div className="fg"><label>Mot de passe</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&go()}/></div>
          <button className="btn btn-p" style={{width:"100%",justifyContent:"center",padding:12,marginTop:4}} onClick={go}><SI n="lock" s={15}/>Se connecter</button>
        </div>
        <div style={{marginTop:18,padding:12,background:"#f8f9fc",borderRadius:8,fontSize:12,color:"#6b7280",lineHeight:1.8,border:"1px solid #e2e6f0"}}>
          <strong style={{color:"#374151"}}>Comptes demo :</strong><br/>
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
        {[{l:"Total dossiers",v:total,c:"#4f46e5"},{l:"En cours",v:enCours,c:"#d97706"},{l:"Termines",v:termines,c:"#059669"},{l:"Impayes",v:impayes,c:"#dc2626"}].map((s,i)=>(
          <div className="stat-card" key={i} style={{"--sc":s.c}}>
            <div className="stat-val" style={{color:s.c}}>{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div className="card">
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:"#111827"}}>Statuts</h3>
          {STATUSES.map(s=>{const c=dossiers.filter(d=>d.status===s.key).length;return(
            <div key={s.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <span className="sdot" style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
              <span style={{fontSize:12,flex:1,color:"#374151"}}>{s.label}</span>
              <div style={{flex:2,background:"#eef0f6",borderRadius:3,height:7,overflow:"hidden"}}><div style={{width:(total?c/total*100:0)+"%",height:"100%",background:s.color,borderRadius:3}}/></div>
              <span style={{fontSize:11,color:"#6b7280",width:18,textAlign:"right",fontWeight:600}}>{c}</span>
            </div>
          );})}
        </div>
        <div className="card">
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:"#111827"}}>Charge par employe</h3>
          {empDist.slice(0,7).map(e=>(
            <div className="emp-bar" key={e.name}>
              <span style={{fontSize:11,fontWeight:600,width:68,flexShrink:0,color:"#374151"}}>{e.name}</span>
              <div className="emp-track"><div className="emp-fill" style={{width:(e.count/maxEmp*100)+"%"}}/></div>
              <span style={{fontSize:11,color:"#6b7280",width:18,textAlign:"right",fontWeight:600}}>{e.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:700,color:"#111827"}}>Revenus encaisses</h3>
          <span style={{fontWeight:800,fontSize:22,color:"#059669"}}>{totalPaid.toLocaleString("fr-FR")} €</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {WORK_TYPES.map(wt=>{const c=dossiers.filter(d=>d.works.some(w=>w.type===wt)).length;return(
            <div key={wt} style={{background:"#f8f9fc",border:"1px solid #e2e6f0",borderRadius:8,padding:"10px 14px",flex:"1",minWidth:110}}>
              <div style={{fontSize:10,color:"#6b7280",marginBottom:3,fontWeight:600}}>{wt}</div>
              <div style={{fontSize:20,fontWeight:800,color:"#111827"}}>{c}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

function DossierForm({initial, onSave, onClose, currentUser}){
  const empty={client:"",email:"",phone:"",address:"",dp_number:"",works:[],status:"nouveau",assignee:EMPLOYEES[0],paid:false,amount:0,client_access:false,notes:[],docs:[]};
  const [f,setF]=useState(initial?{...initial}:empty);
  const [scanning,setScanning]=useState(false);
  const [dpDetected,setDpDetected]=useState(null);
  const pdfRef=useRef();
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setW=(i,k,v)=>{const w=[...f.works];w[i]={...w[i],[k]:v};set("works",w);};
  const addW=()=>set("works",[...f.works,{type:"ITE",dossier_type:"Demande Prealable"}]);
  const rmW=i=>set("works",f.works.filter((_,j)=>j!==i));

  const handlePDFScan = async (file) => {
    if(!file || !file.name.endsWith(".pdf")) return;
    setScanning(true);
    setDpDetected(null);
    const dp = await extractDPFromPDF(file);
    setScanning(false);
    if(dp) {
      setDpDetected(dp);
      set("dp_number", dp);
    } else {
      setDpDetected("not_found");
    }
  };

  const save=()=>{
    if(!f.client.trim())return;
    const now=new Date().toISOString().split("T")[0];
    const id=initial?.id||("DOS-"+new Date().getFullYear()+"-"+(Math.floor(Math.random()*900)+100));
    const token=f.client_access?(initial?.client_token||("tok_"+Date.now())):null;
    onSave({...f,id,created:initial?.created||now,updated:now,docs:initial?.docs||[],notes:initial?.notes||[],client_token:token});
  };

  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="mhdr">
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:"#111827"}}>{initial?"Modifier":"Nouveau dossier"}</h2>
            {initial&&<div style={{fontSize:11,color:"#4f46e5",marginTop:3,fontWeight:600}}>{initial.id}</div>}
          </div>
          <button className="bic" onClick={onClose}><SI n="x"/></button>
        </div>
        <div className="mbody">
          <div className="form-grid" style={{marginBottom:18}}>
            <div className="fg"><label>Nom complet *</label><input value={f.client} onChange={e=>set("client",e.target.value)} placeholder="Prenom Nom"/></div>
            <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
            <div className="fg"><label>Telephone</label><input value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
            <div className="fg full">
              <label>Numero DP — ou importer un PDF pour extraction automatique</label>
              <div style={{display:"flex",gap:8}}>
                <input value={f.dp_number} onChange={e=>set("dp_number",e.target.value)} placeholder="DP 075 111 24 00001" style={{flex:1}}/>
                <button className="btn btn-s btn-sm" style={{flexShrink:0}} onClick={()=>pdfRef.current.click()}>
                  <SI n="scan" s={14}/>Scanner PDF
                </button>
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e=>handlePDFScan(e.target.files[0])}/>
              {scanning && (
                <div className="scanning">
                  <span className="spin">⟳</span> Lecture du PDF en cours...
                </div>
              )}
              {dpDetected && dpDetected !== "not_found" && (
                <div className="dp-detected">
                  <SI n="check" s={16} c="#059669"/>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#059669"}}>N° DP detecte automatiquement !</div>
                    <div style={{fontSize:13,color:"#111827",fontWeight:600,marginTop:2}}>{dpDetected}</div>
                  </div>
                </div>
              )}
              {dpDetected === "not_found" && (
                <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#d97706",marginTop:8}}>
                  Aucun N° DP trouve dans ce PDF. Saisis-le manuellement.
                </div>
              )}
            </div>
            <div className="fg full"><label>Adresse</label><input value={f.address} onChange={e=>set("address",e.target.value)}/></div>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <p style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>Type de travaux</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16,background:"#f8f9fc",padding:12,borderRadius:8,border:"1px solid #e2e6f0"}}>
            {WORK_TYPES.map(t=>{
              const isSelected = f.works.some(w=>w.type===t);
              return (
                <label key={t} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,fontWeight:500}}>
                  <input type="checkbox" checked={isSelected} onChange={e=>{
                    if(e.target.checked){
                      const formalites = Array.from(new Set(f.works.map(w=>w.dossier_type)));
                      if(formalites.length===0) formalites.push("Demande Prealable");
                      set("works",[...f.works,...formalites.map(d=>({type:t,dossier_type:d}))]);
                    } else {
                      set("works",f.works.filter(w=>w.type!==t));
                    }
                  }}/>
                  {t}
                </label>
              );
            })}
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <p style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase"}}>Type de formalités</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16,background:"#f8f9fc",padding:12,borderRadius:8,border:"1px solid #e2e6f0"}}>
            {DOSSIER_TYPES.map(d=>{
              const isSelected = f.works.some(w=>w.dossier_type===d);
              return (
                <label key={d} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,fontWeight:500}}>
                  <input type="checkbox" checked={isSelected} onChange={e=>{
                    if(e.target.checked){
                      const types = Array.from(new Set(f.works.map(w=>w.type)));
                      if(types.length===0) types.push("PAC");
                      set("works",[...f.works,...types.map(t=>({type:t,dossier_type:d}))]);
                    } else {
                      set("works",f.works.filter(w=>w.dossier_type!==d));
                    }
                  }}/>
                  {d}
                </label>
              );
            })}
          </div>

          <div className="form-grid" style={{marginTop:14}}>
            <div className="fg"><label>Statut</label><select value={f.status} onChange={e=>set("status",e.target.value)}>{STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
            <div className="fg"><label>Responsable</label><select value={f.assignee} onChange={e=>set("assignee",e.target.value)}>{EMPLOYEES.map(e=><option key={e}>{e}</option>)}</select></div>
            {currentUser.role!=="admin"&&<div className="fg"><label>Montant (€)</label><input type="number" value={f.amount} onChange={e=>set("amount",Number(e.target.value))}/></div>}
            <div className="fg" style={{gap:10,justifyContent:"flex-end"}}>
              <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,fontWeight:500}}><input type="checkbox" checked={f.paid} onChange={e=>set("paid",e.target.checked)}/>Paye</label>
              <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:13,fontWeight:500}}><input type="checkbox" checked={f.client_access} onChange={e=>set("client_access",e.target.checked)}/>Acces client</label>
            </div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-s" onClick={onClose}>Annuler</button>
          <button className="btn btn-p" onClick={save}><SI n="check" s={14}/>{initial?"Enregistrer":"Creer"}</button>
        </div>
      </div>
    </div>
  );
}

function DossierDetail({dossier, onClose, onUpdate, currentUser, toast}){
  const [tab,setTab]=useState("info");
  const [note,setNote]=useState("");
  const [editing,setEditing]=useState(false);
  const [d,setD]=useState({...dossier});
  const [scanning,setScanning]=useState(false);
  const fRef=useRef();
  const save=(u)=>{const nd={...d,...u,updated:new Date().toISOString().split("T")[0]};setD(nd);onUpdate(nd);toast("Mis a jour","s");};
  const addNote=()=>{if(!note.trim())return;save({notes:[...d.notes,{author:currentUser.name,date:new Date().toISOString().split("T")[0],text:note}]});setNote("");};
  
  const handleFile=async(files)=>{
    const newDocs=Array.from(files).map(f=>({name:f.name,size:Math.round(f.size/1024)+" KB",date:new Date().toISOString().split("T")[0]}));
    const updatedDossier={docs:[...d.docs,...newDocs]};
    
    // Chercher les PDF et extraire le DP automatiquement
    const pdfFiles=Array.from(files).filter(f=>f.name.endsWith(".pdf"));
    if(pdfFiles.length>0 && !d.dp_number){
      setScanning(true);
      for(const pdfFile of pdfFiles){
        const dp=await extractDPFromPDF(pdfFile);
        if(dp){
          updatedDossier.dp_number=dp;
          toast("N° DP detecte automatiquement : "+dp,"s");
          break;
        }
      }
      setScanning(false);
    }
    
    save(updatedDossier);
    toast(newDocs.length+" fichier(s) ajoute(s)","s");
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:800}}>
        <div className="mhdr">
          <div>
            <div style={{fontSize:11,color:"#4f46e5",fontWeight:700,marginBottom:3}}>{d.id}</div>
            <h2 style={{fontSize:18,fontWeight:800,color:"#111827"}}>{d.client}</h2>
            <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{d.address}</div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
            {currentUser.role!=="employee"&&<button className="btn btn-s btn-sm" onClick={()=>setEditing(true)}><SI n="edit" s={13}/>Modifier</button>}
            <button className="bic" onClick={onClose}><SI n="x"/></button>
          </div>
        </div>
        <div style={{padding:"0 24px",borderBottom:"1px solid #e2e6f0"}}>
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
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
                <SBadge status={d.status}/>
                <span className="asgn"><span className="asgn-av">{d.assignee[0]}</span>{d.assignee}</span>
                {d.client_access&&<span className="chip">Acces client actif</span>}
                {d.paid&&<span style={{color:"#059669",fontSize:12,fontWeight:700,background:"#ecfdf5",padding:"4px 10px",borderRadius:20,border:"1px solid #a7f3d0"}}>✓ Paye</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <div>{[["Email",d.email],["Telephone",d.phone],["Adresse",d.address],["N° DP",d.dp_number]].map(([l,v])=>(
                  <div key={l} style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,color:"#111827",fontWeight:500}}>{v||"—"}</div>
                  </div>
                ))}</div>
                <div>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Travaux</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {/* Demande Prealable */}
                      {d.works.some(w=>w.dossier_type==="Demande Prealable")&&(
                        <div style={{background:"#eef2ff",border:"1px solid #4f46e5",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#4f46e5"}}>Demande Prealable</span>
                          <span style={{fontSize:12,color:"#4f46e5"}}>✓</span>
                        </div>
                      )}
                      
                      {/* Raccordement */}
                      {d.works.some(w=>w.dossier_type==="Raccordement")&&(
                        <div style={{background:"#fef3c7",border:"1px solid #d97706",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#d97706"}}>Raccordement</span>
                          <span style={{fontSize:12,color:"#d97706"}}>✓</span>
                        </div>
                      )}
                      
                      {/* PAC */}
                      {d.works.some(w=>w.type==="PAC")&&(
                        <div style={{background:"#dcfce7",border:"1px solid #059669",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#059669"}}>PAC</span>
                          <span style={{fontSize:12,color:"#059669"}}>✓</span>
                        </div>
                      )}
                      
                      {/* ITE */}
                      {d.works.some(w=>w.type==="ITE")&&(
                        <div style={{background:"#fce7f3",border:"1px solid #ec4899",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#ec4899"}}>ITE</span>
                          <span style={{fontSize:12,color:"#ec4899"}}>✓</span>
                        </div>
                      )}
                      
                      {/* Consuel */}
                      {d.works.some(w=>w.dossier_type==="Consuel")&&(
                        <div style={{background:"#dbeafe",border:"1px solid #0284c7",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#0284c7"}}>Consuel</span>
                          <span style={{fontSize:12,color:"#0284c7"}}>✓</span>
                        </div>
                      )}

                      {/* TVA */}
                      {d.works.some(w=>w.dossier_type==="Recuperation TVA")&&(
                        <div style={{background:"#fae8ff",border:"1px solid #a855f7",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:5}}>
                          <span style={{fontSize:10,fontWeight:700,color:"#a855f7"}}>Récupération TVA</span>
                          <span style={{fontSize:12,color:"#a855f7"}}>✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {currentUser.role!=="admin"&&(
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:3}}>Montant</div>
                      <div style={{fontSize:22,fontWeight:800,color:d.paid?"#059669":"#d97706"}}>{d.amount.toLocaleString("fr-FR")} €</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {tab==="documents"&&(
            <div>
              <div className="upload-z" onClick={()=>fRef.current.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#4f46e5";}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handleFile(e.dataTransfer.files);}}
                style={{opacity:scanning?0.6:1,pointerEvents:scanning?"none":"auto"}}>
                {scanning?<div style={{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}><span className="spin" style={{fontSize:24}}>⟳</span><p style={{color:"#4f46e5",fontSize:13,fontWeight:600}}>Lecture du PDF et extraction du N° DP...</p></div>:(
                  <>
                    <SI n="upload" s={30} c="#4f46e5"/>
                    <p style={{color:"#374151",marginTop:8,fontSize:14,fontWeight:600}}>Glisser-deposer ou cliquer</p>
                    <p style={{color:"#9ca3af",fontSize:12,marginTop:3}}>PDF, JPG, PNG, DOCX...</p>
                  </>
                )}
              </div>
              <input ref={fRef} type="file" multiple style={{display:"none"}} onChange={e=>handleFile(e.target.files)} disabled={scanning}/>
              {!d.docs.length&&<p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:24}}>Aucun document</p>}
              {d.docs.map((doc,i)=>(
                <div className="doc-item" key={i}>
                  <div style={{width:36,height:36,background:"#eef2ff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><SI n="download" s={16} c="#4f46e5"/></div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{doc.name}</div><div style={{fontSize:11,color:"#9ca3af"}}>{doc.size} · {doc.date}</div></div>
                  <button className="btn btn-s btn-sm" onClick={()=>toast("Telechargement : "+doc.name,"i")}><SI n="download" s={12}/>DL</button>
                  <button className="btn btn-d btn-sm" onClick={()=>save({docs:d.docs.filter((_,j)=>j!==i)})}><SI n="trash" s={12}/></button>
                </div>
              ))}
            </div>
          )}
          {tab==="notes"&&(
            <div>
              <div style={{display:"flex",gap:9,marginBottom:18}}>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Ajouter une note..." style={{flex:1,minHeight:68,color:"#111827"}}/>
                <button className="btn btn-p" style={{alignSelf:"flex-end"}} onClick={addNote}><SI n="msg" s={14}/>Envoyer</button>
              </div>
              {[...d.notes].reverse().map((n,i)=>(
                <div className="note-item" key={i}>
                  <div style={{fontSize:11,color:"#9ca3af",marginBottom:5,display:"flex",gap:8}}><strong style={{color:"#4f46e5"}}>{n.author}</strong><span>{n.date}</span></div>
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.6}}>{n.text}</div>
                </div>
              ))}
              {!d.notes.length&&<p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:20}}>Aucune note</p>}
            </div>
          )}
          {tab==="paiement"&&(
            <div>
              {currentUser.role!=="admin"&&(
                <div style={{background:d.paid?"#ecfdf5":"#fffbeb",border:"1px solid "+(d.paid?"#a7f3d0":"#fcd34d"),borderRadius:10,padding:18,display:"flex",alignItems:"center",gap:16,marginBottom:18,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>Montant</div>
                    <div style={{fontWeight:800,fontSize:28,color:d.paid?"#059669":"#d97706"}}>{d.amount.toLocaleString("fr-FR")} €</div>
                    <div style={{marginTop:8}}><SBadge status={d.paid?"valide":"en_attente"}/></div>
                  </div>
                  {!d.paid&&<button className="btn btn-p" onClick={()=>toast("Lien envoye a "+d.client,"i")}><SI n="mail" s={14}/>Envoyer lien client</button>}
                </div>
              )}
              {currentUser.role==="admin"&&(
                <div style={{background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:10,padding:18,marginBottom:18}}>
                  <div style={{fontSize:13,color:"#6b7280",fontStyle:"italic"}}>Accès administrateur : Montant non visible</div>
                </div>
              )}
              {currentUser.role==="superadmin"&&(
                <div style={{display:"flex",gap:10}}>
                  <button className="btn btn-g" disabled={d.paid} style={{opacity:d.paid?.5:1}} onClick={()=>{save({paid:true});toast("Paiement valide","s");}}><SI n="check" s={14}/>Marquer paye</button>
                  <button className="btn btn-d" disabled={!d.paid} style={{opacity:!d.paid?.5:1}} onClick={()=>save({paid:false})}>Annuler</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {editing&&<DossierForm initial={d} onSave={u=>{setD(u);onUpdate(u);setEditing(false);toast("Modifie","s");}} onClose={()=>setEditing(false)} currentUser={currentUser}/>}
    </div>
  );
}

function Dossiers({dossiers, setDossiers, currentUser, toast}){
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
  const create=d=>{setDossiers(p=>[d,...p]);setCreating(false);toast("Dossier cree","s");};
  const upd=d=>{setDossiers(p=>p.map(x=>x.id===d.id?d:x));setSel(d);};
  const del=id=>{setDossiers(p=>p.filter(x=>x.id!==id));setSel(null);toast("Supprime","i");};
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:"#111827"}}>Dossiers</h2>
          <p style={{color:"#6b7280",fontSize:12,marginTop:2}}>{filtered.length} resultat(s) sur {dossiers.length}</p>
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
              {!filtered.length&&<tr><td colSpan={8} style={{textAlign:"center",padding:36,color:"#9ca3af"}}>Aucun resultat</td></tr>}
              {filtered.map(d=>(
                <tr key={d.id} onClick={()=>setSel(d)}>
                  <td style={{fontWeight:700,fontSize:12,color:"#4f46e5",fontFamily:"monospace"}}>{d.id}</td>
                  <td style={{fontWeight:600,color:"#111827"}}>{d.client}</td>
                  <td style={{color:"#6b7280",fontSize:12,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.address}</td>
                  <td><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{d.works.map((w,i)=><span key={i} className="chip">{w.type}</span>)}</div></td>
                  <td><span className="asgn"><span className="asgn-av">{d.assignee[0]}</span>{d.assignee}</span></td>
                  <td><SBadge status={d.status}/></td>
                  <td><span style={{color:d.paid?"#059669":"#9ca3af",fontSize:12,fontWeight:600}}>{d.paid?"✓ Paye":"En attente"}</span></td>
                  <td onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5}}>
                      <button className="bic" onClick={()=>setSel(d)}><SI n="eye" s={13}/></button>
                      {currentUser.role==="superadmin"&&<button className="bic" style={{color:"#dc2626"}} onClick={()=>del(d.id)}><SI n="trash" s={13}/></button>}
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

function Clients({dossiers, toast}){
  const [q,setQ]=useState("");
  const clients=useMemo(()=>{
    const m={};
    dossiers.forEach(d=>{if(!m[d.email])m[d.email]={...d,count:0};m[d.email].count++;});
    return Object.values(m).filter(c=>!q||c.client.toLowerCase().includes(q.toLowerCase())||c.address.toLowerCase().includes(q.toLowerCase()));
  },[dossiers,q]);
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:800,color:"#111827",marginBottom:4}}>Clients</h2>
      <p style={{color:"#6b7280",fontSize:12,marginBottom:16}}>{clients.length} client(s)</p>
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        <div className="srch-wrap"><span className="srch-ico"><SI n="search" s={15}/></span><input className="srch" placeholder="Nom, email, adresse..." value={q} onChange={e=>setQ(e.target.value)}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {clients.map(c=>(
          <div className="card" key={c.email}>
            <div style={{display:"flex",gap:11,marginBottom:12,alignItems:"flex-start"}}>
              <div className="avatar" style={{width:44,height:44,fontSize:15,flexShrink:0,borderRadius:12}}>{c.client[0]}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#111827"}}>{c.client}</div><div style={{fontSize:12,color:"#6b7280",marginTop:1}}>{c.email}</div></div>
              <span style={{background:"#eef2ff",color:"#4f46e5",padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,border:"1px solid #c7d2fe"}}>{c.count}</span>
            </div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:4}}>{c.phone}</div>
            <div style={{fontSize:12,color:"#374151",marginBottom:14}}>{c.address}</div>
            <button className="btn btn-s btn-sm" onClick={()=>toast("Email envoye a "+c.client,"s")}><SI n="mail" s={12}/>Email</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Paiements({dossiers, setDossiers, currentUser, toast}){
  const unpaid=dossiers.filter(d=>!d.paid);
  const paid=dossiers.filter(d=>d.paid);
  const mark=id=>{setDossiers(p=>p.map(d=>d.id===id?{...d,paid:true}:d));toast("Paiement valide - Super Admin notifie","s");};
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:800,color:"#111827",marginBottom:18}}>Paiements</h2>
      <div className="stats-grid" style={{marginBottom:20}}>
        {[
          {l:"Encaisse",v:paid.reduce((s,d)=>s+d.amount,0).toLocaleString("fr-FR")+" €",c:"#059669"},
          {l:"En attente",v:unpaid.reduce((s,d)=>s+d.amount,0).toLocaleString("fr-FR")+" €",c:"#d97706"},
          {l:"Payes",v:paid.length,c:"#4f46e5"},
          {l:"Impayes",v:unpaid.length,c:"#dc2626"},
        ].map((s,i)=>(
          <div className="stat-card" key={i} style={{"--sc":s.c}}>
            <div className="stat-val" style={{color:s.c,fontSize:typeof s.v==="string"?20:28}}>{s.v}</div>
            <div className="stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:14}}>En attente</h3>
        {!unpaid.length&&<p style={{color:"#9ca3af",fontSize:13}}>Tous les dossiers sont a jour 🎉</p>}
        {unpaid.map(d=>(
          <div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #e2e6f0",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:130}}><div style={{fontWeight:600,color:"#111827"}}>{d.client}</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{d.id} · {d.assignee}</div></div>
            <div style={{fontWeight:800,fontSize:18,color:"#d97706"}}>{d.amount.toLocaleString("fr-FR")} €</div>
            <button className="btn btn-s btn-sm" onClick={()=>toast("Lien envoye a "+d.client,"i")}><SI n="mail" s={12}/>Lien</button>
            {currentUser.role==="superadmin"&&<button className="btn btn-g btn-sm" onClick={()=>mark(d.id)}><SI n="check" s={12}/>Valider</button>}
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:14}}>Recus</h3>
        {paid.map(d=>(
          <div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #e2e6f0",flexWrap:"wrap"}}>
            <div style={{flex:1}}><div style={{fontWeight:600,color:"#111827"}}>{d.client}</div><div style={{fontSize:11,color:"#9ca3af"}}>{d.id}</div></div>
            <div style={{fontWeight:700,fontSize:15,color:"#059669"}}>{d.amount.toLocaleString("fr-FR")} €</div>
            <span style={{color:"#059669",fontSize:12,fontWeight:700,background:"#ecfdf5",padding:"3px 10px",borderRadius:20,border:"1px solid #a7f3d0"}}>✓ Paye</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Import({setDossiers, toast}){
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
      }catch{toast("Erreur de lecture","e");}
    };r.readAsText(file);
  };
  const confirm=()=>{
    const now=new Date().toISOString().split("T")[0];
    const nd=preview.map((row,i)=>({id:"IMP-"+Date.now()+"-"+i,client:row.client||row.nom||("Client "+(i+1)),email:row.email||"",phone:row.phone||row.tel||"",address:row.address||row.adresse||"",dp_number:row.dp_number||"",works:[{type:row.type_travaux||"ITE",dossier_type:"Demande Prealable"}],status:"nouveau",assignee:EMPLOYEES[0],paid:false,amount:Number(row.amount||0),created:now,updated:now,docs:[],notes:[],client_access:false,client_token:null}));
    setDossiers(p=>[...nd,...p]);setPreview([]);toast(nd.length+" dossiers importes","s");
  };
  return (
    <div>
      <h2 style={{fontSize:20,fontWeight:800,color:"#111827",marginBottom:4}}>Import de donnees</h2>
      <p style={{color:"#6b7280",fontSize:13,marginBottom:20}}>Importez vos anciens fichiers clients CSV ou JSON.</p>
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{fontSize:13,fontWeight:700,color:"#111827",marginBottom:10}}>Format CSV attendu</h3>
        <code style={{display:"block",background:"#f8f9fc",padding:12,borderRadius:8,fontSize:12,color:"#4f46e5",overflowX:"auto",border:"1px solid #e2e6f0"}}>client,email,phone,address,dp_number,type_travaux,type_dossier,amount</code>
      </div>
      <div className="upload-z" onClick={()=>fRef.current.click()}
        onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#4f46e5";}}
        onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
        onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handle(e.dataTransfer.files);}}>
        <SI n="import" s={36} c="#4f46e5"/>
        <p style={{fontSize:15,fontWeight:700,marginTop:10,color:"#111827"}}>Glisser votre fichier ici</p>
        <p style={{fontSize:12,color:"#9ca3af",marginTop:4}}>CSV ou JSON</p>
      </div>
      <input ref={fRef} type="file" accept=".csv,.json" style={{display:"none"}} onChange={e=>handle(e.target.files)}/>
      {preview.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <h3 style={{fontSize:14,fontWeight:700,color:"#111827"}}>Apercu</h3>
            <button className="btn btn-p" onClick={confirm}><SI n="check" s={14}/>Confirmer</button>
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
      <h2 style={{fontSize:20,fontWeight:800,color:"#111827",marginBottom:20}}>Administration</h2>
      <div className="card" style={{marginBottom:14}}>
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:14}}>Utilisateurs</h3>
        {USERS.map(u=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,padding:"12px 14px",background:"#f8f9fc",borderRadius:8,border:"1px solid #e2e6f0"}}>
            <div className="avatar">{u.initials}</div>
            <div style={{flex:1}}><div style={{fontWeight:600,color:"#111827"}}>{u.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{u.email}</div></div>
            <span style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:u.role==="superadmin"?"#fffbeb":"#eef2ff",color:u.role==="superadmin"?"#d97706":"#4f46e5",border:"1px solid "+(u.role==="superadmin"?"#fcd34d":"#c7d2fe")}}>{u.role}</span>
          </div>
        ))}
        <button className="btn btn-p btn-sm" style={{marginTop:8}} onClick={()=>toast("Invitation envoyee","s")}><SI n="plus" s={13}/>Inviter</button>
      </div>
      <div className="card">
        <h3 style={{fontSize:14,fontWeight:700,color:"#111827",marginBottom:14}}>Securite</h3>
        {[["2FA active","Protege les comptes"],["Tokens clients","Liens securises"],["HTTPS force","Chiffrement transit"],["Journaux acces","Tracabilite complete"]].map(([t,d])=>(
          <div key={t} style={{display:"flex",gap:10,alignItems:"center",marginBottom:9,padding:"10px 12px",background:"#f8f9fc",borderRadius:8,border:"1px solid #e2e6f0"}}>
            <SI n="lock" s={16} c="#059669"/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#111827"}}>{t}</div><div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{d}</div></div>
            <span style={{color:"#059669",fontSize:11,fontWeight:700,background:"#ecfdf5",padding:"3px 9px",borderRadius:20,border:"1px solid #a7f3d0"}}>Actif</span>
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
    ...(user.role==="superadmin"?[{id:"admin",icon:"settings",label:"Admin"}]:[]),
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
        {sbOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.3)",zIndex:99}} onClick={()=>setSbOpen(false)}/>}
        <div className={"sb"+(sbOpen?" open":"")}>
          <div className="sb-logo">
            <div className="logo-icon">☀️</div>
            <div><div className="logo-name">SolarCRM</div><div className="logo-sub">Pro</div></div>
          </div>
          <div className="sb-nav">
            <div className="nav-lbl">Navigation</div>
            {nav.map(item=>(
              <div key={item.id} className={"nav-item"+(page===item.id?" active":"")} onClick={()=>{setPage(item.id);setSbOpen(false);}}>
                <SI n={item.icon} s={15} c={page===item.id?"#4f46e5":"#6b7280"}/>
                <span style={{flex:1,color:page===item.id?"#4f46e5":"#374151"}}>{item.label}</span>
                {item.badge>0&&<span className="nbadge">{item.badge}</span>}
              </div>
            ))}
          </div>
          <div className="sb-user">
            <div className="avatar">{user.initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"#111827",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>{user.role}</div>
            </div>
            <button style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"#9ca3af",display:"flex"}} onClick={()=>setUser(null)}><SI n="logout" s={15}/></button>
          </div>
        </div>
        <div className="main">
          <div className="topbar">
            <button className="bic" onClick={()=>setSbOpen(o=>!o)}><SI n="menu" c="#374151"/></button>
            <div className="topbar-title">{titles[page]}</div>
            <button className="bic" onClick={()=>toast("Aucune notification","i")}><SI n="bell" s={17} c="#374151"/></button>
            <div className="avatar" style={{width:32,height:32,fontSize:11,cursor:"default",flexShrink:0}}>{user.initials}</div>
          </div>
          <div className="content">{pages[page]||pages.dashboard}</div>
        </div>
      </div>
      <Toasts toasts={toasts} rm={rmToast}/>
    </>
  );
}