import { useState, useEffect, useCallback, useRef } from "react";
import {
  getEmailTemplates,
  createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  previewEmail, sendEmail, scheduleEmail,
  getEmailQueue, cancelQueuedEmail, updateQueuedEmail,
  getEmailLog,
} from "./api.js";

// ── Icons (inline SVG) ────────────────────────────────────────────────────────

const Ic = {
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Template: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Clock: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Log: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Eye: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Ban: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
};

// ── Category labels ───────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  client:        { label: 'Client',         color: '#E8501A', bg: '#FEF0EB' },
  mairie:        { label: 'Mairie',          color: '#1A4A8A', bg: '#EEF3FD' },
  administration:{ label: 'Administration',  color: '#059669', bg: '#ecfdf5' },
  general:       { label: 'Général',         color: '#6B6B60', bg: '#F5F5F0' },
};

function CatBadge({ cat }) {
  const c = CATEGORY_LABELS[cat] || CATEGORY_LABELS.general;
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700,
      color:c.color, background:c.bg, whiteSpace:'nowrap' }}>{c.label}</span>
  );
}

function StatusBadge({ status }) {
  const map = {
    sent:      { label:'Envoyé',    color:'#059669', bg:'#ecfdf5' },
    pending:   { label:'En attente',color:'#d97706', bg:'#fffbeb' },
    error:     { label:'Erreur',    color:'#dc2626', bg:'#fef2f2' },
    cancelled: { label:'Annulé',   color:'#6B6B60', bg:'#F5F5F0' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700,
      color:s.color, background:s.bg }}>{s.label}</span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success:'#059669', error:'#dc2626', info:'#1A4A8A' };
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:colors[type]||colors.info,
      color:'#fff', padding:'11px 18px', borderRadius:10, fontSize:13, fontWeight:600,
      boxShadow:'0 8px 24px rgba(0,0,0,.18)', display:'flex', alignItems:'center', gap:10, maxWidth:340 }}>
      {type === 'success' && <Ic.Check />}
      {type === 'error' && <Ic.X />}
      <span>{msg}</span>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 700 }) {
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth }}>
        <div className="mhdr">
          <span style={{ fontWeight:800, fontSize:16, color:'var(--or)' }}>{title}</span>
          <button className="bic" onClick={onClose}><Ic.X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Compose / Send modal ──────────────────────────────────────────────────────

function ComposeModal({ templates, dossiers = [], onClose, onSent, initialTemplateId = '' }) {
  const [tab, setTab] = useState('template'); // 'template' | 'manual'
  const [editMode, setEditMode] = useState('visual'); // 'visual' | 'html'
  const [templateId, setTemplateId] = useState(String(initialTemplateId));
  const [dossierId, setDossierId] = useState('');
  const [dossierSearch, setDossierSearch] = useState('');
  const [dossierDropOpen, setDossierDropOpen] = useState(false);
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [extraVars, setExtraVars] = useState('');
  const visualRef = useRef(null);
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Le dossier fournit uniquement les variables (DP, client...) — pas le destinataire

  const dossierQ = dossierSearch.toLowerCase();
  const filteredDossiers = (dossiers || []).filter(dd => {
    if (!dossierQ) return true;
    return [dd.dp_number, dd.client, dd.client_org, dd.email, dd.id]
      .filter(Boolean).join(' ').toLowerCase().includes(dossierQ);
  });

  const selectDossier = (dd) => {
    setDossierId(dd.id);
    setDossierSearch([dd.dp_number, dd.client, dd.client_org].filter(Boolean).join(' — '));
    setDossierDropOpen(false);
  };

  const clearDossier = () => {
    setDossierId('');
    setDossierSearch('');
  };

  const parseExtraVars = () => {
    try { return extraVars ? JSON.parse(extraVars) : {}; } catch { return {}; }
  };

  // Texte brut → HTML (si pas de balises détectées)
  const normalizeToHtml = (text) => {
    if (!text) return '';
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    return text.split(/\n\n+/).map(p => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  };

  // bodyHtmlRef permet au callback ref de lire la valeur courante sans en dépendre (évite remontage à chaque frappe)
  const bodyHtmlRef = useRef(bodyHtml);
  bodyHtmlRef.current = bodyHtml;

  const setVisualRef = useCallback(el => {
    visualRef.current = el;
    if (el) el.innerHTML = bodyHtmlRef.current; // injecte le contenu dès le montage du div
  }, []);

  // Auto-preview en écriture libre (temps réel)
  useEffect(() => {
    if (tab !== 'manual') return;
    if (!bodyHtml && !subject) { setPreview(null); return; }
    setPreview({ subject: subject || '(sans sujet)', body_html: normalizeToHtml(bodyHtml) });
  }, [tab, bodyHtml, subject]);

  const handlePreview = useCallback(async (tid, did) => {
    const id = tid !== undefined ? tid : templateId;
    if (!id) { setPreview(null); return; }
    setPreviewLoading(true);
    try {
      const data = await previewEmail({ template_id: Number(id), dossier_id: (did !== undefined ? did : dossierId) || undefined, variables: parseExtraVars() });
      setPreview(data);
    } catch (e) {
      // silencieux en auto-preview
    } finally { setPreviewLoading(false); }
  }, [templateId, dossierId, extraVars]);

  // Auto-preview dès qu'on change de template
  useEffect(() => { handlePreview(templateId, dossierId); }, [templateId, dossierId]);

  const handleSend = async () => {
    if (!to) return alert('Destinataire requis');
    setLoading(true);
    try {
      const payload = {
        to, to_name: toName || undefined,
        template_id: tab === 'template' && templateId ? Number(templateId) : undefined,
        dossier_id: dossierId || undefined,
        subject: tab === 'manual' ? subject : undefined,
        body_html: tab === 'manual' ? normalizeToHtml(bodyHtml) : undefined,
        variables: parseExtraVars(),
        attachments,
      };
      if (schedule && scheduledAt) {
        await scheduleEmail({ ...payload, scheduled_at: new Date(scheduledAt).toISOString() });
        onSent('programmé');
      } else {
        await sendEmail(payload);
        onSent('envoyé');
      }
      onClose();
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally { setLoading(false); }
  };

  const tplObj = templates.find(t => String(t.id) === String(templateId));

  // Layout : overlay plein écran → deux colonnes côte à côte
  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ alignItems:'center', justifyContent:'center', display:'flex', padding:'20px 16px' }}>
      <div style={{ display:'flex', gap:16, alignItems:'stretch', width:'100%', maxWidth:1200, maxHeight:'92vh' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Colonne gauche : formulaire ── */}
        <div style={{ flex:'0 0 500px', background:'var(--bg2)', borderRadius:'var(--rl)',
          boxShadow:'var(--shl)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Header */}
          <div className="mhdr">
            <span style={{ fontWeight:800, fontSize:15, color:'var(--or)' }}>
              {tplObj ? `Composer — ${tplObj.name}` : 'Composer un email'}
            </span>
            <button className="bic" onClick={onClose}><Ic.X /></button>
          </div>
          {/* Body scrollable */}
          <div className="mbdy" style={{ display:'flex', flexDirection:'column', gap:14, flex:1, overflowY:'auto' }}>
            <div className="tabs" style={{ marginBottom:4 }}>
              {[['template','Depuis un template'],['manual','Écriture libre']].map(([k,l]) => (
                <button key={k} className={`tab${tab===k?' act':''}`} onClick={() => {
                  if (k === 'manual' && tab === 'template' && preview) {
                    // Toujours injecter le contenu du template rendu (design + texte)
                    setBodyHtml(preview.body_html || '');
                    setSubject(preview.subject || '');
                  }
                  setTab(k);
                }}>{l}</button>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="fg" style={{ position:'relative' }}>
                <label className="lbl" style={{ color:'var(--or)' }}>Dossier — N° DP, client, partenaire</label>
                <div style={{ display:'flex', alignItems:'center', gap:6, border:'1.5px solid var(--bd)',
                  borderRadius:'var(--r)', padding:'6px 10px', background:'var(--bg3)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input value={dossierSearch}
                    onChange={e => { setDossierSearch(e.target.value); setDossierId(''); setDossierDropOpen(true); }}
                    onFocus={() => setDossierDropOpen(true)}
                    onBlur={() => setTimeout(() => setDossierDropOpen(false), 150)}
                    placeholder="Rechercher..."
                    style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, fontFamily:'var(--ff)', color:'var(--tx)' }}
                  />
                  {dossierId && (
                    <button onClick={clearDossier} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'var(--tx4)', display:'flex' }}>
                      <Ic.X />
                    </button>
                  )}
                </div>
                {dossierDropOpen && filteredDossiers.length > 0 && !dossierId && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10,
                    background:'var(--bg2)', border:'1.5px solid var(--bd)', borderRadius:'var(--r)',
                    maxHeight:200, overflowY:'auto', boxShadow:'0 16px 40px rgba(0,0,0,.14)', marginTop:2 }}>
                    {filteredDossiers.slice(0, 20).map(dd => (
                      <div key={dd.id} onClick={() => selectDossier(dd)}
                        style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', color:'var(--tx)', display:'flex', alignItems:'center', gap:6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--or-l)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {dd.dp_number && <span style={{ fontWeight:700, color:'var(--or)', fontSize:11,
                          background:'var(--or-l)', padding:'1px 6px', borderRadius:6, flexShrink:0 }}>{dd.dp_number}</span>}
                        <span style={{ fontWeight:600 }}>{dd.client || `#${dd.id}`}</span>
                        {dd.client_org && <span style={{ color:'var(--tx3)', fontSize:12 }}>({dd.client_org})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="fg">
                <label className="lbl" style={{ color:'var(--or)' }}>Destinataire *</label>
                <input autoComplete="nope" name="email-destinataire" value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemple.fr" />
              </div>
            </div>

            <div className="fg">
              <label className="lbl" style={{ color:'var(--or)' }}>Nom destinataire</label>
              <input autoComplete="off" name="nom-destinataire" value={toName} onChange={e => setToName(e.target.value)} placeholder="Prénom Nom (optionnel)" />
            </div>

            {tab === 'template' && (<>
              <div className="fg">
                <label className="lbl" style={{ color:'var(--or)' }}>Template *</label>
                <select className="fsel" style={{ width:'100%', padding:'8px 10px' }} value={templateId} onChange={e => setTemplateId(e.target.value)}>
                  <option value="">— choisir un template —</option>
                  {Object.entries(
                    templates.reduce((acc, t) => { (acc[t.category] = acc[t.category] || []).push(t); return acc; }, {})
                  ).map(([cat, tpls]) => (
                    <optgroup key={cat} label={(CATEGORY_LABELS[cat]||{label:cat}).label}>
                      {tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              {tplObj && (
                <div style={{ background:'var(--bg3)', border:'1.5px solid var(--bd)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--tx3)' }}>
                  <strong style={{ color:'var(--tx2)' }}>{tplObj.name}</strong>
                  <span style={{ marginLeft:10 }}><CatBadge cat={tplObj.category} /></span>
                  <div style={{ marginTop:4 }}>Variables : {(tplObj.variables||[]).map(v => (
                    <code key={v} style={{ background:'var(--bg2)', padding:'1px 5px', borderRadius:4, marginRight:4, fontSize:11 }}>{`{{${v}}}`}</code>
                  ))}</div>
                </div>
              )}
              <div className="fg">
                <label className="lbl" style={{ color:'var(--or)' }}>Variables supplémentaires (JSON, optionnel)</label>
                <input value={extraVars} onChange={e => setExtraVars(e.target.value)}
                  placeholder='{"missing_docs": "• KBIS\\n• RIB"}' />
              </div>
            </>)}

            {tab === 'manual' && (<>
              <div className="fg">
                <label className="lbl" style={{ color:'var(--or)' }}>Sujet *</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet de l'email" />
              </div>
              <div className="fg">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <label className="lbl" style={{ color:'var(--or)', margin:0 }}>Corps du mail *</label>
                  <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--bd)', borderRadius:6, overflow:'hidden' }}>
                    {[['visual','Visuel'],['html','HTML']].map(([m,l]) => (
                      <button key={m}
                        onClick={() => {
                          if (m === 'html' && editMode === 'visual' && visualRef.current) {
                            setBodyHtml(visualRef.current.innerHTML);
                          }
                          setEditMode(m);
                        }}
                        style={{ padding:'3px 12px', fontSize:11, fontWeight:600, border:'none', cursor:'pointer',
                          background: editMode===m ? 'var(--or)' : 'transparent',
                          color: editMode===m ? '#fff' : 'var(--tx3)',
                          transition:'background .15s' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {editMode === 'visual' ? (
                  <div
                    ref={setVisualRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => setBodyHtml(e.currentTarget.innerHTML)}
                    style={{
                      minHeight:160, padding:12,
                      border:'1.5px solid var(--bd)', borderRadius:'var(--r)',
                      background:'#fff', outline:'none',
                      fontSize:13, fontFamily:'var(--ff)', color:'#000',
                      lineHeight:1.6, overflowY:'auto',
                    }}
                  />
                ) : (
                  <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
                    style={{ minHeight:160, fontFamily:'monospace', fontSize:12 }}
                    placeholder="<p>Bonjour,</p><p>...</p>" />
                )}
              </div>
            </>)}

            {/* Pièces jointes */}
            <div className="fg">
              <label className="lbl" style={{ color:'var(--or)' }}>Pièces jointes</label>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 14px', background:'var(--bg3)', border:'1.5px dashed var(--bd)', borderRadius:8, cursor:'pointer', fontSize:13, color:'var(--tx2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Ajouter un fichier
                <input type="file" multiple style={{ display:'none' }}
                  onChange={e => setAttachments(prev => [...prev, ...Array.from(e.target.files)])} />
              </label>
              {attachments.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                  {attachments.map((f, i) => (
                    <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'var(--or-l)', border:'1px solid var(--or)', borderRadius:20, fontSize:12, color:'var(--or)', fontWeight:600 }}>
                      {f.name}
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--or)', fontWeight:900, padding:0, lineHeight:1, fontSize:14 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" id="sched" checked={schedule} onChange={e => setSchedule(e.target.checked)} />
              <label htmlFor="sched" style={{ fontSize:13, cursor:'pointer', color:'var(--tx2)' }}>Programmer l'envoi</label>
            </div>
            {schedule && (
              <div className="fg">
                <label className="lbl" style={{ color:'var(--or)' }}>Date et heure d'envoi *</label>
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
            )}
          </div>
          {/* Footer */}
          <div className="mftr" style={{ justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {previewLoading && <span style={{ fontSize:11, color:'var(--tx3)' }}>Chargement aperçu...</span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-s" onClick={onClose}>Annuler</button>
              <button className="btn btn-p" onClick={handleSend} disabled={loading}>
                {schedule ? <Ic.Clock /> : <Ic.Send />}
                {loading ? 'Envoi...' : (schedule ? 'Programmer' : 'Envoyer')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Colonne droite : aperçu ── */}
        <div style={{
          flex:1, minWidth:0,
          background:'var(--bg2)', borderRadius:'var(--rl)',
          boxShadow:'var(--shl)', display:'flex', flexDirection:'column',
          overflow:'hidden',
          opacity: preview ? 1 : 0.35,
          transition:'opacity .25s',
        }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bd)', background:'var(--bg3)', flexShrink:0 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'var(--or)' }}>Aperçu du mail</div>
            {preview && <div style={{ fontSize:12, color:'var(--tx2)', marginTop:2 }}>{preview.subject}</div>}
            {!preview && <div style={{ fontSize:12, color:'var(--tx4)', marginTop:2 }}>Sélectionnez un template pour voir l'aperçu</div>}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:0 }}>
            {preview
              ? <div dangerouslySetInnerHTML={{ __html: preview.body_html }} style={{ fontSize:13 }} />
              : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--tx4)', fontSize:13 }}>—</div>
            }
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Template editor modal ─────────────────────────────────────────────────────

function TemplateModal({ template, onClose, onSaved }) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [category, setCategory] = useState(template?.category || 'general');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
  const [bodyText, setBodyText] = useState(template?.body_text || '');
  const [variables, setVariables] = useState((template?.variables || []).join(', '));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name || !subject || !bodyHtml) return alert('Nom, sujet et corps HTML requis');
    setLoading(true);
    try {
      const vars = variables.split(',').map(v => v.trim()).filter(Boolean);
      if (template?.id) {
        await updateEmailTemplate(template.id, { name, subject, category, body_html: bodyHtml, body_text: bodyText, variables: vars });
      } else {
        await createEmailTemplate({ name, subject, category, body_html: bodyHtml, body_text: bodyText, variables: vars });
      }
      onSaved();
      onClose();
    } catch (e) {
      alert('Erreur : ' + e.message);
    } finally { setLoading(false); }
  };

  return (
    <Modal title={template?.id ? 'Modifier le template' : 'Nouveau template'} onClose={onClose} maxWidth={820}>
      <div className="mbdy" style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
          <div className="fg">
            <label className="lbl">Nom du template *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Confirmation dossier" />
          </div>
          <div className="fg">
            <label className="lbl">Catégorie</label>
            <select className="fsel" style={{ width:'100%', padding:'8px 10px' }} value={category} onChange={e => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="lbl">Sujet *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet — utilisez {{variable}} pour les variables" />
        </div>
        <div className="fg">
          <label className="lbl">Variables disponibles (séparées par des virgules)</label>
          <input value={variables} onChange={e => setVariables(e.target.value)}
            placeholder="client_name, dossier_id, dp_number, date_today, ..." />
          <span style={{ fontSize:11, color:'var(--tx4)', marginTop:3 }}>
            Variables auto-remplies : client_name, client_email, client_phone, client_address, dossier_id, dp_number, status, assignee, amount, date_today, company_name, company_email
          </span>
        </div>
        <div className="fg">
          <label className="lbl">Corps HTML * <span style={{ fontWeight:400, textTransform:'none', fontSize:10 }}>(utilisez {`{{variable}}`} pour les variables)</span></label>
          <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
            style={{ minHeight:200, fontFamily:'monospace', fontSize:12 }}
            placeholder="<p>Bonjour {{client_name}},</p>" />
        </div>
        <div className="fg">
          <label className="lbl">Corps texte brut (optionnel)</label>
          <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
            style={{ minHeight:80 }}
            placeholder="Version texte brut de l'email..." />
        </div>
      </div>
      <div className="mftr">
        <button className="btn btn-s" onClick={onClose}>Annuler</button>
        <button className="btn btn-p" onClick={handleSave} disabled={loading}>
          <Ic.Check /> {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </Modal>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({ template, onClose, onUse }) {
  return (
    <Modal title={`Aperçu — ${template.name}`} onClose={onClose} maxWidth={700}>
      <div className="mbdy">
        <div style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13 }}>
          <div style={{ color:'var(--tx3)', fontSize:11, marginBottom:2 }}>SUJET</div>
          <div style={{ fontWeight:600 }}>{template.subject}</div>
        </div>
        <div style={{ border:'1.5px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
          <div dangerouslySetInnerHTML={{ __html: template.body_html }}
            style={{ padding:16, maxHeight:420, overflowY:'auto' }} />
        </div>
      </div>
      <div className="mftr">
        <button className="btn btn-s" onClick={onClose}>Fermer</button>
        <button className="btn btn-p" onClick={() => { onUse(template); onClose(); }}>
          <Ic.Send /> Utiliser ce template
        </button>
      </div>
    </Modal>
  );
}

// ── Tab: Composer ─────────────────────────────────────────────────────────────

function TabCompose({ templates, dossiers, showCompose, setShowCompose, toast, initialTemplateId = '', onModalClose }) {
  return (
    <div style={{ padding:'24px 0' }}>
      <div style={{ textAlign:'center', padding:'48px 24px' }}>
        <div style={{ width:64, height:64, background:'var(--or-l)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>
          ✉️
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--or)', marginBottom:8 }}>Envoyer un email</div>
        <div style={{ color:'var(--tx3)', fontSize:14, marginBottom:24, maxWidth:400, margin:'0 auto 24px' }}>
          Composez et envoyez un email à un client, une mairie ou une administration — avec ou sans template.
        </div>
        <button className="btn btn-p" onClick={() => setShowCompose(true)}>
          <Ic.Plus /> Composer un email
        </button>
      </div>
      {showCompose && (
        <ComposeModal
          templates={templates}
          dossiers={dossiers}
          initialTemplateId={initialTemplateId}
          onClose={() => { setShowCompose(false); onModalClose && onModalClose(); }}
          onSent={(mode) => toast(`Email ${mode} avec succès`, 'success')}
        />
      )}
    </div>
  );
}

// ── Tab: Templates ────────────────────────────────────────────────────────────

function TabTemplates({ templates, setTemplates, toast, onUseTemplate }) {
  const [editing, setEditing] = useState(null);    // null | {} | template
  const [previewing, setPreviewing] = useState(null);

  const reload = useCallback(async () => {
    const data = await getEmailTemplates();
    setTemplates(data);
  }, [setTemplates]);

  const handleDelete = async (t) => {
    if (!window.confirm(`Supprimer le template "${t.name}" ?`)) return;
    try {
      await deleteEmailTemplate(t.id);
      toast('Template supprimé', 'success');
      reload();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  };

  const grouped = templates.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  const CAT_ORDER = ['client','mairie','administration','general'];
  const sortedEntries = CAT_ORDER
    .filter(k => grouped[k])
    .map(k => [k, grouped[k]])
    .concat(Object.entries(grouped).filter(([k]) => !CAT_ORDER.includes(k)));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <button className="btn btn-p btn-sm" onClick={() => setEditing({})}>
          <Ic.Plus /> Nouveau template
        </button>
      </div>

      {sortedEntries.map(([cat, tpls]) => {
        const cl = CATEGORY_LABELS[cat] || CATEGORY_LABELS.general;
        return (
          <div key={cat} style={{ marginBottom:28 }}>
            {/* En-tête de catégorie */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:3, height:18, background:cl.color, borderRadius:2, flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:800, color:cl.color, textTransform:'uppercase', letterSpacing:'.08em' }}>
                {cl.label}
              </span>
              <span style={{ fontSize:11, color:'var(--tx3)', background:'var(--bg3)', borderRadius:10, padding:'1px 8px' }}>
                {tpls.length}
              </span>
            </div>

            {/* Tableau */}
            <div style={{ background:'var(--bg2)', border:'1.5px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
              {tpls.map((t, i) => (
                <div key={t.id} style={{
                  display:'grid', gridTemplateColumns:'1fr auto',
                  alignItems:'center', gap:16,
                  padding:'13px 16px',
                  borderBottom: i < tpls.length - 1 ? '1px solid var(--bd)' : 'none',
                  transition:'background .12s',
                }}>
                  {/* Infos */}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'var(--tx1)', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize:12, color:'var(--tx3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {t.subject}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button className="bic" title="Aperçu" onClick={() => setPreviewing(t)}><Ic.Eye /></button>
                    <button className="bic" title="Utiliser" style={{ color:'var(--or)' }} onClick={() => onUseTemplate(t)}><Ic.Send /></button>
                    <button className="bic" title="Modifier" onClick={() => setEditing(t)}><Ic.Edit /></button>
                    <button className="bic" title="Supprimer" style={{ color:'var(--re)' }} onClick={() => handleDelete(t)}><Ic.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {editing !== null && (
        <TemplateModal template={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={() => { toast('Template sauvegardé', 'success'); reload(); }} />
      )}
      {previewing && (
        <PreviewModal template={previewing} onClose={() => setPreviewing(null)}
          onUse={(t) => onUseTemplate(t)} />
      )}
    </div>
  );
}

// ── Edit modal for a queued email ─────────────────────────────────────────────

function EditQueueModal({ item, onClose, onSaved }) {
  const [to, setTo] = useState(item.to_email || '');
  const [toName, setToName] = useState(item.to_name || '');
  const [subject, setSubject] = useState(item.subject || '');
  const [bodyHtml, setBodyHtml] = useState(item.body_html || '');
  const [scheduledAt, setScheduledAt] = useState(
    item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0,16) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!to) return;
    setSaving(true);
    try {
      await updateQueuedEmail(item.id, {
        to, to_name: toName, subject, body_html: bodyHtml,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      onSaved();
      onClose();
    } catch (e) { alert('Erreur : ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Modifier l'email programmé" onClose={onClose} maxWidth={680}>
      <div className="mbdy" style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="fg">
            <label className="lbl" style={{ color:'var(--or)' }}>Destinataire *</label>
            <input autoComplete="nope" value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemple.fr" />
          </div>
          <div className="fg">
            <label className="lbl" style={{ color:'var(--or)' }}>Nom destinataire</label>
            <input autoComplete="nope" value={toName} onChange={e => setToName(e.target.value)} placeholder="Prénom Nom" />
          </div>
        </div>
        <div className="fg">
          <label className="lbl" style={{ color:'var(--or)' }}>Sujet *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Sujet de l'email" />
        </div>
        <div className="fg">
          <label className="lbl" style={{ color:'var(--or)' }}>Date d'envoi programmé</label>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>
        <div className="fg">
          <label className="lbl" style={{ color:'var(--or)' }}>Corps du mail (HTML)</label>
          <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
            rows={10} style={{ fontFamily:'monospace', fontSize:12, resize:'vertical' }} />
        </div>
        {bodyHtml && (
          <details style={{ border:'1px solid var(--bd)', borderRadius:8, padding:'8px 12px' }}>
            <summary style={{ fontSize:12, color:'var(--tx3)', cursor:'pointer', userSelect:'none' }}>Aperçu rendu</summary>
            <div style={{ marginTop:8, padding:8, background:'#fff', borderRadius:6, border:'1px solid var(--bd)' }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </details>
        )}
      </div>
      <div className="mftr">
        <button className="btn btn-s" onClick={onClose}>Annuler</button>
        <button className="btn btn-p" onClick={handleSave} disabled={saving || !to}>
          {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </Modal>
  );
}

// ── Tab: Queue ────────────────────────────────────────────────────────────────

function TabQueue({ toast }) {
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hovered, setHovered] = useState(null); // item survolé pour aperçu

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getEmailQueue(filter ? { status: filter } : {});
    setQueue(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { reload(); }, [reload]);

  const handleCancel = async (id) => {
    try {
      await cancelQueuedEmail(id);
      toast('Email annulé', 'success');
      reload();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  };

  return (
    <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
      {/* Liste des emails */}
      <div style={{ flex:'0 0 380px', minWidth:0 }}>
        {editing && (
          <EditQueueModal
            item={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { toast('Email mis à jour', 'success'); reload(); }}
          />
        )}
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--tx3)', fontWeight:600 }}>Filtrer :</span>
          {[['', 'Tous'], ['pending','En attente'], ['sent','Envoyés'], ['error','Erreurs'], ['cancelled','Annulés']].map(([v,l]) => (
            <button key={v} className={`btn btn-sm ${filter===v?'btn-p':'btn-s'}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
          <button className="bic" style={{ marginLeft:'auto' }} onClick={reload} title="Actualiser">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tx4)' }}>Chargement...</div>
        ) : queue.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--tx4)', fontSize:13 }}>Aucun email dans la file</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {queue.map(item => (
              <div key={item.id}
                onMouseEnter={() => setHovered(item)}
                onMouseLeave={() => setHovered(h => h?.id === item.id ? null : h)}
                style={{
                  background:'var(--bg2)',
                  border: hovered?.id === item.id ? '1.5px solid var(--or)' : '1.5px solid var(--bd)',
                  borderRadius:10, padding:'12px 16px',
                  display:'flex', alignItems:'flex-start', gap:12,
                  cursor:'default', transition:'border-color .15s',
                }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{item.to_email}</span>
                    {item.to_name && <span style={{ fontSize:12, color:'var(--tx3)' }}>({item.to_name})</span>}
                    <StatusBadge status={item.status} />
                  </div>
                  <div style={{ fontSize:12, color:'var(--tx2)', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.subject}</div>
                  <div style={{ fontSize:11, color:'var(--tx4)' }}>
                    {item.scheduled_at && <span>Programmé : {new Date(item.scheduled_at).toLocaleString('fr-FR')}</span>}
                    {item.sent_at && <span> · Envoyé : {new Date(item.sent_at).toLocaleString('fr-FR')}</span>}
                    {item.dossier_id && <span> · Dossier : {item.dossier_id}</span>}
                  </div>
                  {item.error && <div style={{ fontSize:11, color:'var(--re)', marginTop:4 }}>{item.error}</div>}
                </div>
                {item.status === 'pending' && (
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button className="bic" title="Modifier" style={{ color:'var(--or)' }} onClick={() => setEditing(item)}>
                      <Ic.Edit />
                    </button>
                    <button className="bic" title="Annuler" style={{ color:'var(--re)' }} onClick={() => handleCancel(item.id)}>
                      <Ic.Ban />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panneau aperçu à droite */}
      <div style={{
        flex:1, minWidth:0,
        position:'sticky', top:0,
        background:'var(--bg2)',
        border:'1.5px solid var(--bd)',
        borderRadius:12,
        overflow:'hidden',
        transition:'opacity .2s',
        opacity: hovered ? 1 : 0,
        pointerEvents: hovered ? 'auto' : 'none',
        minHeight:300,
      }}>
        {hovered && (<>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bd)', background:'var(--bg3)', display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:13, color:'var(--or)' }}>{hovered.to_email}</span>
              {hovered.to_name && <span style={{ fontSize:12, color:'var(--tx3)' }}>— {hovered.to_name}</span>}
              <StatusBadge status={hovered.status} />
            </div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--tx1)' }}>{hovered.subject}</div>
            {hovered.scheduled_at && (
              <div style={{ fontSize:11, color:'var(--tx4)' }}>
                Programmé : {new Date(hovered.scheduled_at).toLocaleString('fr-FR')}
              </div>
            )}
          </div>
          <div style={{ padding:16, overflow:'auto', maxHeight:'calc(70vh - 80px)' }}>
            {hovered.body_html
              ? <div dangerouslySetInnerHTML={{ __html: hovered.body_html }} style={{ fontSize:13 }} />
              : <div style={{ color:'var(--tx4)', fontSize:13, textAlign:'center', padding:40 }}>Aucun contenu HTML</div>
            }
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Tab: Log ──────────────────────────────────────────────────────────────────

function TabLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getEmailLog();
    setLog(data);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="bic" onClick={reload} title="Actualiser">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--tx4)' }}>Chargement...</div>
      ) : log.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--tx4)', fontSize:13 }}>Aucun email envoyé pour l'instant</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Destinataire</th>
                <th>Sujet</th>
                <th>Dossier</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {log.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight:500 }}>{item.to_email}</td>
                  <td style={{ maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.subject}</td>
                  <td>{item.dossier_id || '—'}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td style={{ whiteSpace:'nowrap', fontSize:12, color:'var(--tx4)' }}>
                    {item.sent_at ? new Date(item.sent_at).toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main EmailModule ──────────────────────────────────────────────────────────

export default function EmailModule({ dossiers = [] }) {
  const [tab, setTab] = useState('compose');
  const [templates, setTemplates] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getEmailTemplates().then(setTemplates).catch(console.error);
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
  }, []);

  const [composeTemplateId, setComposeTemplateId] = useState('');

  const handleUseTemplate = (template) => {
    setComposeTemplateId(String(template.id));
    setTab('compose');
    setShowCompose(true);
  };

  const TABS = [
    { key:'compose',   icon:<Ic.Send />,     label:'Composer' },
    { key:'templates', icon:<Ic.Template />, label:'Templates' },
    { key:'queue',     icon:<Ic.Clock />,    label:'File d\'attente' },
    { key:'log',       icon:<Ic.Log />,      label:'Historique' },
  ];

  return (
    <div className="content">
      <div style={{ maxWidth:960, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-.025em', marginBottom:4 }}>Emails</h2>
            <p style={{ color:'var(--tx3)', fontSize:13 }}>
              Envoi automatique, templates et suivi des communications
            </p>
          </div>
          <button className="btn btn-p" onClick={() => { setTab('compose'); setShowCompose(true); }}>
            <Ic.Plus /> Nouvel email
          </button>
        </div>

        {/* Tabs */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="tabs" style={{ padding:'0 20px', marginBottom:0, borderRadius:'var(--rl) var(--rl) 0 0' }}>
            {TABS.map(t => (
              <button key={t.key} className={`tab${tab===t.key?' act':''}`}
                onClick={() => setTab(t.key)}
                style={{ display:'flex', alignItems:'center', gap:6 }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding:'20px' }}>
            {tab === 'compose' && (
              <TabCompose
                templates={templates}
                dossiers={dossiers}
                showCompose={showCompose}
                setShowCompose={setShowCompose}
                toast={showToast}
                initialTemplateId={composeTemplateId}
                onModalClose={() => setComposeTemplateId('')}
              />
            )}
            {tab === 'templates' && (
              <TabTemplates
                templates={templates}
                setTemplates={setTemplates}
                toast={showToast}
                onUseTemplate={handleUseTemplate}
              />
            )}
            {tab === 'queue' && <TabQueue toast={showToast} />}
            {tab === 'log' && <TabLog />}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Global compose modal triggered from other tabs */}
      {tab !== 'compose' && showCompose && (
        <ComposeModal
          templates={templates}
          dossiers={dossiers}
          initialTemplateId={composeTemplateId}
          onClose={() => { setShowCompose(false); setComposeTemplateId(''); }}
          onSent={(mode) => showToast(`Email ${mode} avec succès`, 'success')}
        />
      )}
    </div>
  );
}
