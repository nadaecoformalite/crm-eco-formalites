import { useState, useEffect, useCallback } from "react";
import {
  getEmailTemplates, getEmailTemplate,
  createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  previewEmail, sendEmail, scheduleEmail,
  getEmailQueue, cancelQueuedEmail,
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
          <span style={{ fontWeight:800, fontSize:16 }}>{title}</span>
          <button className="bic" onClick={onClose}><Ic.X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Compose / Send modal ──────────────────────────────────────────────────────

function ComposeModal({ templates, dossiers = [], onClose, onSent }) {
  const [tab, setTab] = useState('template'); // 'template' | 'manual'
  const [templateId, setTemplateId] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [to, setTo] = useState('');
  const [toName, setToName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [extraVars, setExtraVars] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auto-fill recipient from dossier
  useEffect(() => {
    if (!dossierId) return;
    const d = dossiers.find(x => x.id === dossierId);
    if (d) { setTo(d.email || ''); setToName(d.client || ''); }
  }, [dossierId, dossiers]);

  const parseExtraVars = () => {
    try { return extraVars ? JSON.parse(extraVars) : {}; } catch { return {}; }
  };

  const handlePreview = async () => {
    if (!templateId) return;
    setPreviewLoading(true);
    try {
      const data = await previewEmail({ template_id: Number(templateId), dossier_id: dossierId || undefined, variables: parseExtraVars() });
      setPreview(data);
    } catch (e) {
      alert('Erreur prévisualisation : ' + e.message);
    } finally { setPreviewLoading(false); }
  };

  const handleSend = async () => {
    if (!to) return alert('Destinataire requis');
    setLoading(true);
    try {
      const payload = {
        to, to_name: toName || undefined,
        template_id: tab === 'template' && templateId ? Number(templateId) : undefined,
        dossier_id: dossierId || undefined,
        subject: tab === 'manual' ? subject : undefined,
        body_html: tab === 'manual' ? bodyHtml : undefined,
        body_text: tab === 'manual' ? bodyText : undefined,
        variables: parseExtraVars(),
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

  return (
    <Modal title="Composer un email" onClose={onClose} maxWidth={760}>
      <div className="mbdy" style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom:4 }}>
          {[['template','Depuis un template'],['manual','Écriture libre']].map(([k,l]) => (
            <button key={k} className={`tab${tab===k?' act':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* Dossier picker (both modes) */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="fg">
            <label className="lbl">Dossier associé (optionnel)</label>
            <select className="fsel" style={{ width:'100%', padding:'8px 10px' }} value={dossierId} onChange={e => setDossierId(e.target.value)}>
              <option value="">— aucun —</option>
              {dossiers.map(d => <option key={d.id} value={d.id}>{d.client} ({d.id})</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="lbl">Destinataire *</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemple.fr" />
          </div>
        </div>

        <div className="fg">
          <label className="lbl">Nom destinataire</label>
          <input value={toName} onChange={e => setToName(e.target.value)} placeholder="Prénom Nom (optionnel)" />
        </div>

        {tab === 'template' && (
          <>
            <div className="fg">
              <label className="lbl">Template *</label>
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
              <label className="lbl">Variables supplémentaires (JSON, optionnel)</label>
              <input value={extraVars} onChange={e => setExtraVars(e.target.value)}
                placeholder='{"missing_docs": "• KBIS\\n• RIB"}' />
            </div>
          </>
        )}

        {tab === 'manual' && (
          <>
            <div className="fg">
              <label className="lbl">Sujet *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet de l'email" />
            </div>
            <div className="fg">
              <label className="lbl">Corps HTML *</label>
              <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} style={{ minHeight:140 }}
                placeholder="<p>Bonjour,</p><p>...</p>" />
            </div>
            <div className="fg">
              <label className="lbl">Corps texte brut (optionnel)</label>
              <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} style={{ minHeight:60 }}
                placeholder="Version texte de l'email..." />
            </div>
          </>
        )}

        {/* Schedule */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="checkbox" id="sched" checked={schedule} onChange={e => setSchedule(e.target.checked)} />
          <label htmlFor="sched" style={{ fontSize:13, cursor:'pointer', color:'var(--tx2)' }}>Programmer l'envoi</label>
        </div>
        {schedule && (
          <div className="fg">
            <label className="lbl">Date et heure d'envoi *</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div style={{ border:'1.5px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ background:'var(--bg3)', padding:'8px 14px', borderBottom:'1px solid var(--bd)', fontSize:12, fontWeight:700, color:'var(--tx2)' }}>
              Aperçu — {preview.subject}
            </div>
            <div style={{ padding:16, maxHeight:280, overflowY:'auto' }}
              dangerouslySetInnerHTML={{ __html: preview.body_html }} />
          </div>
        )}
      </div>

      <div className="mftr" style={{ justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:8 }}>
          {tab === 'template' && templateId && (
            <button className="btn btn-s btn-sm" onClick={handlePreview} disabled={previewLoading}>
              <Ic.Eye /> {previewLoading ? 'Chargement...' : 'Aperçu'}
            </button>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-s" onClick={onClose}>Annuler</button>
          <button className="btn btn-p" onClick={handleSend} disabled={loading}>
            {schedule ? <Ic.Clock /> : <Ic.Send />}
            {loading ? 'Envoi...' : (schedule ? 'Programmer' : 'Envoyer')}
          </button>
        </div>
      </div>
    </Modal>
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

function TabCompose({ templates, dossiers, showCompose, setShowCompose, toast }) {
  return (
    <div style={{ padding:'24px 0' }}>
      <div style={{ textAlign:'center', padding:'48px 24px' }}>
        <div style={{ width:64, height:64, background:'var(--or-l)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:32 }}>
          ✉️
        </div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--tx)', marginBottom:8 }}>Envoyer un email</div>
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
          onClose={() => setShowCompose(false)}
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

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-p btn-sm" onClick={() => setEditing({})}>
          <Ic.Plus /> Nouveau template
        </button>
      </div>

      {Object.entries(grouped).map(([cat, tpls]) => (
        <div key={cat} style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--tx3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>
            {(CATEGORY_LABELS[cat]||{label:cat}).label} ({tpls.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {tpls.map(t => (
              <div key={t.id} style={{ background:'var(--bg2)', border:'1.5px solid var(--bd)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{t.name}</span>
                    <CatBadge cat={t.category} />
                  </div>
                  <div style={{ fontSize:12, color:'var(--tx3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.subject}</div>
                  {t.variables?.length > 0 && (
                    <div style={{ marginTop:4 }}>
                      {t.variables.map(v => (
                        <code key={v} style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:4, marginRight:4, fontSize:10, color:'var(--tx3)' }}>{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button className="bic" title="Aperçu" onClick={() => setPreviewing(t)}><Ic.Eye /></button>
                  <button className="bic" title="Utiliser" onClick={() => onUseTemplate(t)}>
                    <Ic.Send />
                  </button>
                  <button className="bic" title="Modifier" onClick={() => setEditing(t)}><Ic.Edit /></button>
                  <button className="bic" title="Supprimer" style={{ color:'var(--re)' }} onClick={() => handleDelete(t)}><Ic.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

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

// ── Tab: Queue ────────────────────────────────────────────────────────────────

function TabQueue({ toast }) {
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);

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
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
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
            <div key={item.id} style={{ background:'var(--bg2)', border:'1.5px solid var(--bd)', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{item.to_email}</span>
                  {item.to_name && <span style={{ fontSize:12, color:'var(--tx3)' }}>({item.to_name})</span>}
                  <StatusBadge status={item.status} />
                </div>
                <div style={{ fontSize:12, color:'var(--tx2)', marginBottom:2 }}>{item.subject}</div>
                <div style={{ fontSize:11, color:'var(--tx4)' }}>
                  {item.scheduled_at && <span>Programmé : {new Date(item.scheduled_at).toLocaleString('fr-FR')}</span>}
                  {item.sent_at && <span> · Envoyé : {new Date(item.sent_at).toLocaleString('fr-FR')}</span>}
                  {item.dossier_id && <span> · Dossier : {item.dossier_id}</span>}
                </div>
                {item.error && <div style={{ fontSize:11, color:'var(--re)', marginTop:4 }}>{item.error}</div>}
              </div>
              {item.status === 'pending' && (
                <button className="bic" title="Annuler" style={{ color:'var(--re)' }} onClick={() => handleCancel(item.id)}>
                  <Ic.Ban />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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

  const handleUseTemplate = (template) => {
    setTab('compose');
    setShowCompose(true);
    // The compose modal will handle pre-selecting the template
    // via URL param or state — for simplicity, just open compose
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
          onClose={() => setShowCompose(false)}
          onSent={(mode) => showToast(`Email ${mode} avec succès`, 'success')}
        />
      )}
    </div>
  );
}
