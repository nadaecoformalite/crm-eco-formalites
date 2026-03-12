import { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  getDocuments, uploadDocuments, deleteDocument,
  updateDocument, getDocumentVersions, applyExtractedData,
} from "./api.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).toString();

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// ── Document categories ───────────────────────────────────────────────────────

export const DOC_CATEGORIES = [
  { key: 'dp',            label: 'Demande Préalable', icon: '🏛️', color: '#6366f1', bg: '#eef2ff', extractDP: true },
  { key: 'kbis',          label: 'KBIS',              icon: '🏢', color: '#1A4A8A', bg: '#EEF3FD', extractKbis: true },
  { key: 'raccordement',  label: 'Raccordement',       icon: '⚡', color: '#059669', bg: '#ecfdf5' },
  { key: 'consuel',       label: 'CONSUEL',            icon: '✅', color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'devis',         label: 'Devis',              icon: '📋', color: '#E8501A', bg: '#FEF0EB' },
  { key: 'facture',       label: 'Facture',            icon: '🧾', color: '#d97706', bg: '#fffbeb' },
  { key: 'tva',           label: 'Récupération TVA',   icon: '💶', color: '#0891b2', bg: '#ecfeff' },
  { key: 'contrat',       label: 'Contrat',            icon: '📄', color: '#374151', bg: '#f9fafb' },
  { key: 'plan',          label: 'Plan / Schéma',      icon: '📐', color: '#be185d', bg: '#fdf2f8' },
  { key: 'photo',         label: 'Photo',              icon: '📷', color: '#92400e', bg: '#fef3c7' },
  { key: 'autre',         label: 'Autre',              icon: '📁', color: '#6B6B60', bg: '#F5F5F0' },
];

const catMap = Object.fromEntries(DOC_CATEGORIES.map(c => [c.key, c]));

// ── PDF extraction helpers (client-side, pdfjs) ───────────────────────────────

async function extractTextFromPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let prev = null;
    content.items.forEach(item => {
      if (prev?.transform && item.transform) {
        if (Math.abs(item.transform[4] - (prev.transform[4] + (prev.width || 0))) > 3) text += ' ';
      }
      text += item.str;
      prev = item;
    });
    text += '\n';
  }
  return text;
}

async function extractDPNumber(file) {
  try {
    const text = await extractTextFromPDF(file);
    const patterns = [
      /DP[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2,4}[\s\-]?\d{3,6}/gi,
      /\bDP\s{0,3}\d[\d\s]{6,25}/gi,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[0].trim().replace(/\s+/g, ' ').slice(0, 50);
    }
    return null;
  } catch { return null; }
}

async function extractKbisData(file) {
  try {
    const raw = await extractTextFromPDF(file);

    // Normalise : collapse whitespace excessif tout en gardant les sauts de ligne
    const text = raw
      .split('\n')
      .map(l => l.replace(/\s{2,}/g, ' ').trim())
      .join('\n');

    // ── Helper : chercher la valeur qui suit un libellé sur la même ligne ou la suivante ──
    function after(labelPattern) {
      // Tente d'abord "Libellé : valeur" sur la même ligne
      const inline = new RegExp(labelPattern + '[\\s:–-]*([^\\n]{2,100})', 'i');
      const m1 = text.match(inline);
      if (m1) {
        const v = m1[1].trim().replace(/^[:–\-\s]+/, '');
        if (v.length > 1) return v;
      }
      // Sinon la valeur est sur la ligne suivante
      const nextLine = new RegExp(labelPattern + '[^\\n]*\\n([^\\n]{2,100})', 'i');
      const m2 = text.match(nextLine);
      if (m2) return m2[1].trim().replace(/^[:–\-\s]+/, '');
      return null;
    }

    // ── 1. Dénomination sociale → Nom entreprise ──────────────────────────
    const company_name =
      after('D[eé]nomination\\s+sociale') ||
      after('D[eé]nomination') ||
      after('Raison\\s+sociale') ||
      null;

    // ── 2. Immatriculation au RCS → SIRET / SIREN ────────────────────────
    // Le KBIS mentionne "Immatriculation au RCS de VILLE" puis le numéro SIREN (9 chiffres)
    // On accepte aussi le SIRET (14 chiffres) s'il est présent
    let siret = null;
    const rcsBlock = text.match(
      /Immatriculation\s+au\s+RCS[^\n]{0,80}\n?([^\n]{0,80})/i
    );
    if (rcsBlock) {
      // Cherche un numéro 9 ou 14 chiffres (avec espaces ou points éventuels)
      const numM = (rcsBlock[0] + (rcsBlock[1] || '')).match(
        /\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}(?:[\s.]?\d{5})?)\b/
      );
      if (numM) {
        const digits = numM[1].replace(/[\s.]/g, '');
        if (digits.length === 14) {
          siret = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
        } else if (digits.length === 9) {
          siret = digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        }
      }
    }
    // Fallback : chercher un SIRET 14 chiffres n'importe où dans le doc
    if (!siret) {
      const fallback = text.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/);
      if (fallback) {
        const d = fallback[1].replace(/[\s.]/g, '');
        siret = d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
      }
    }

    // ── 3. Adresse du siège → adresse ────────────────────────────────────
    const address =
      after('Adresse\\s+du\\s+si[èe]ge\\s+social') ||
      after('Adresse\\s+du\\s+si[èe]ge') ||
      after('Si[èe]ge\\s+social') ||
      null;

    // ── 4. Représentant légal → représentant ─────────────────────────────
    // Le KBIS liste les représentants sous "Représentant(s) légaux" ou détaille
    // chaque personne avec "Gérant", "Président", "Directeur général", etc.
    const representant =
      after('Repr[eé]sentant(?:s)?\\s+l[eé]gaux?') ||
      after('G[eé]rant') ||
      after('Pr[eé]sident') ||
      after('Directeur\\s+g[eé]n[eé]ral') ||
      after('Dirigeant') ||
      null;

    // Nettoie les valeurs : retire les séquences de points (...), les tirets, etc.
    const clean = v => v ? v.replace(/\.{2,}/g, '').replace(/^\W+/, '').trim() : null;

    return {
      siret:        clean(siret),
      company_name: clean(company_name),
      address:      clean(address),
      representant: clean(representant),
    };
  } catch { return null; }
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon({ mime, size = 28 }) {
  const isImg = mime?.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const isDoc = mime?.includes('word');
  const isXls = mime?.includes('excel') || mime?.includes('spreadsheet');

  const color = isPdf ? '#dc2626' : isImg ? '#7c3aed' : isDoc ? '#1A4A8A' : isXls ? '#059669' : '#6B6B60';
  const label = isPdf ? 'PDF' : isImg ? 'IMG' : isDoc ? 'DOC' : isXls ? 'XLS' : 'FILE';

  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: color + '18',
      border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 800, color, flexShrink: 0 }}>
      {label}
    </div>
  );
}

// ── Extracted data confirmation banner ───────────────────────────────────────

function ExtractionBanner({ data, onApply, onDismiss }) {
  const { dp_number, kbis } = data;
  return (
    <div style={{ background: '#fffbeb', border: '1.5px solid #d97706', borderRadius: 10,
      padding: '12px 16px', margin: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Données extraites automatiquement</span>
      </div>
      {dp_number && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 4 }}>
          <span style={{ color: '#6B6B60' }}>N° Demande Préalable : </span>
          <strong>{dp_number}</strong>
        </div>
      )}
      {kbis?.company_name && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Dénomination sociale : </span><strong>{kbis.company_name}</strong>
        </div>
      )}
      {kbis?.siret && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Immatriculation au RCS : </span><strong>{kbis.siret}</strong>
        </div>
      )}
      {kbis?.address && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Adresse du siège : </span><strong>{kbis.address}</strong>
        </div>
      )}
      {kbis?.representant && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Représentant légal : </span><strong>{kbis.representant}</strong>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-p btn-sm" onClick={onApply}>
          ✓ Appliquer au dossier
        </button>
        <button className="btn btn-s btn-sm" onClick={onDismiss}>Ignorer</button>
      </div>
    </div>
  );
}

// ── PDF Previewer modal ───────────────────────────────────────────────────────

function PDFPreview({ doc, onClose }) {
  const canvasRef = useRef(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const url = `${API_BASE}${doc.url}`;

  useEffect(() => {
    pdfjsLib.getDocument(url).promise.then(pdf => {
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    if (!pdfDoc) return;
    pdfDoc.getPage(pageNum).then(page => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const viewport = page.getViewport({ scale: 1.4 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: canvas.getContext('2d'), viewport });
    });
  }, [pdfDoc, pageNum]);

  const isImage = doc.mime_type?.startsWith('image/');

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--rl)', width: '100%', maxWidth: 860,
        maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shl)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1.5px solid var(--bd)', display: 'flex',
          alignItems: 'center', gap: 12, background: 'var(--bg3)' }}>
          <FileIcon mime={doc.mime_type} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.original_name || doc.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx4)' }}>
              {doc.size_human} · {(catMap[doc.category] || catMap.autre).label} · v{doc.version}
            </div>
          </div>
          <a href={`${API_BASE}${doc.url}`} download={doc.original_name || doc.name}
            className="btn btn-s btn-sm" target="_blank" rel="noreferrer">
            ⬇ Télécharger
          </a>
          <button className="bic" onClick={onClose} style={{ fontSize: 16 }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#1a1a18', display: 'flex',
          alignItems: 'flex-start', justifyContent: 'center', padding: 20 }}>
          {loading && <div style={{ color: '#fff', paddingTop: 40 }}>Chargement...</div>}
          {!loading && isImage && (
            <img src={`${API_BASE}${doc.url}`} alt={doc.name}
              style={{ maxWidth: '100%', borderRadius: 8 }} />
          )}
          {!loading && !isImage && doc.mime_type === 'application/pdf' && (
            <canvas ref={canvasRef} style={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }} />
          )}
          {!loading && !isImage && doc.mime_type !== 'application/pdf' && (
            <div style={{ color: '#fff', textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
              <div>Aperçu non disponible pour ce type de fichier.</div>
              <a href={`${API_BASE}${doc.url}`} download className="btn btn-p" style={{ marginTop: 16 }}
                target="_blank" rel="noreferrer">⬇ Télécharger le fichier</a>
            </div>
          )}
        </div>

        {/* PDF pagination */}
        {doc.mime_type === 'application/pdf' && totalPages > 1 && (
          <div style={{ padding: '10px 20px', borderTop: '1.5px solid var(--bd)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg3)' }}>
            <button className="btn btn-s btn-sm" disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}>←</button>
            <span style={{ fontSize: 13 }}>Page {pageNum} / {totalPages}</span>
            <button className="btn btn-s btn-sm" disabled={pageNum >= totalPages} onClick={() => setPageNum(p => p + 1)}>→</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Versions modal ────────────────────────────────────────────────────────────

function VersionsModal({ docId, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentVersions(docId).then(v => { setVersions(v); setLoading(false); });
  }, [docId]);

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="mhdr">
          <span style={{ fontWeight: 800 }}>Historique des versions</span>
          <button className="bic" onClick={onClose}>✕</button>
        </div>
        <div className="mbdy">
          {loading ? <div style={{ textAlign: 'center', padding: 30, color: 'var(--tx4)' }}>Chargement...</div> :
            versions.length === 0 ? <div style={{ color: 'var(--tx4)', textAlign: 'center', padding: 20 }}>Aucune version</div> :
            versions.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                <FileIcon mime={v.mime_type} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Version {v.version}
                    {v.version === versions[0]?.version &&
                      <span style={{ marginLeft: 8, background: '#ecfdf5', color: '#059669',
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>actuelle</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx4)' }}>
                    {v.size_human} · {v.uploaded_by} · {new Date(v.created).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <a href={`${API_BASE}${v.url}`} download className="btn btn-s btn-sm"
                  target="_blank" rel="noreferrer">⬇</a>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ── Drop zone component ───────────────────────────────────────────────────────

function DropZone({ dossierId, category, onUploaded, onExtracted }) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const inputRef = useRef(null);

  const processFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setProgress('Analyse des fichiers...');

    const catDef = catMap[category] || catMap.autre;
    let extractedData = null;

    // Run PDF extraction for relevant categories
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;

      if (catDef.extractDP) {
        setProgress('Extraction du N° DP...');
        const dp = await extractDPNumber(file);
        if (dp) extractedData = { ...extractedData, dp_number: dp };
      }

      if (catDef.extractKbis) {
        setProgress('Extraction des données KBIS...');
        const kbis = await extractKbisData(file);
        if (kbis && (kbis.siret || kbis.company_name)) {
          extractedData = { ...extractedData, kbis };
        }
      }
    }

    try {
      setProgress('Envoi des fichiers...');
      const result = await uploadDocuments(dossierId, Array.from(files), category, extractedData);
      onUploaded(result);
      if (extractedData) onExtracted(extractedData, dossierId);
    } catch (err) {
      alert('Erreur upload : ' + err.message);
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [dossierId, category, onUploaded, onExtracted]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    setDrag(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  return (
    <div
      className={`upz${drag ? ' drag' : ''}`}
      style={{ position: 'relative' }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
        style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
      {uploading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--or)', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 12, color: 'var(--tx3)', fontWeight: 600 }}>{progress}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 28, marginBottom: 8 }}>☁️</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx2)' }}>
            Glissez vos fichiers ici
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 4 }}>
            ou cliquez pour sélectionner · PDF, images, documents · 20 MB max
          </div>
          {catDef?.extractDP && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--bl)', background: 'var(--bl-l)',
              padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>
              🔍 N° DP extrait automatiquement
            </div>
          )}
          {catDef?.extractKbis && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#1A4A8A', background: '#EEF3FD',
              padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>
              🔍 SIRET + données entreprise extraits automatiquement
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onPreview, onDelete, onVersions, onRename }) {
  const cat = catMap[doc.category] || catMap.autre;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: 'var(--bg3)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
      marginBottom: 6, cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
      onMouseLeave={() => setMenuOpen(false)}>
      <FileIcon mime={doc.mime_type} size={32} />
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => onPreview(doc)}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.original_name || doc.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg,
            padding: '1px 7px', borderRadius: 10 }}>{cat.icon} {cat.label}</span>
          <span style={{ fontSize: 11, color: 'var(--tx4)' }}>{doc.size_human}</span>
          {doc.version > 1 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff',
              padding: '1px 7px', borderRadius: 10, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onVersions(doc); }}>
              v{doc.version}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--tx4)' }}>
            {new Date(doc.created).toLocaleDateString('fr-FR')}
          </span>
          {doc.uploaded_by && (
            <span style={{ fontSize: 11, color: 'var(--tx4)' }}>· {doc.uploaded_by}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="bic btn-sm" title="Aperçu" onClick={() => onPreview(doc)}>👁</button>
        <a href={`${API_BASE}${doc.url}`} download={doc.original_name || doc.name}
          className="bic" title="Télécharger" onClick={e => e.stopPropagation()}>⬇</a>
        <button className="bic btn-sm" title="Versions" onClick={() => onVersions(doc)}>🕐</button>
        <button className="bic btn-sm" title="Supprimer"
          style={{ color: 'var(--re)' }} onClick={() => onDelete(doc)}>🗑</button>
      </div>
    </div>
  );
}

// ── Main GEDModule ────────────────────────────────────────────────────────────

/**
 * GEDModule — can be used in two modes:
 *   1. Standalone page: dossierId=null → shows all documents + filter by dossier
 *   2. Embedded in dossier detail: dossierId="DOS-..." → scoped to that dossier
 */
export default function GEDModule({ dossierId = null, dossierData = null, dossiers = [], onDossierUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [selectedDossier, setSelectedDossier] = useState(dossierId || '');
  const [previewing, setPreviewing] = useState(null);
  const [versioning, setVersioning] = useState(null);
  const [extractedBanner, setExtractedBanner] = useState(null); // { data, dossierId }
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const effectiveDossierId = dossierId || selectedDossier;

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const filters = {};
    if (effectiveDossierId) filters.dossier_id = effectiveDossierId;
    if (category !== 'all') filters.category = category;
    if (search) filters.search = search;
    const data = await getDocuments(filters);
    setDocuments(data);
    setLoading(false);
  }, [effectiveDossierId, category, search]);

  useEffect(() => { reload(); }, [reload]);

  const handleUploaded = useCallback((result) => {
    showToast(`${result.saved.length} fichier(s) uploadé(s)`, 'success');
    reload();
  }, [reload, showToast]);

  const handleExtracted = useCallback((data, dId) => {
    const hasData = data?.dp_number || data?.kbis?.siret || data?.kbis?.company_name;
    if (hasData) setExtractedBanner({ data, dossierId: dId });
  }, []);

  const handleApplyExtracted = async () => {
    if (!extractedBanner) return;
    try {
      await applyExtractedData(extractedBanner.dossierId, extractedBanner.data);
      showToast('Données appliquées au dossier ✓', 'success');
      if (onDossierUpdate) onDossierUpdate(extractedBanner.dossierId, extractedBanner.data);
    } catch (e) {
      showToast('Erreur : ' + e.message, 'error');
    }
    setExtractedBanner(null);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Supprimer "${doc.original_name || doc.name}" ?`)) return;
    try {
      await deleteDocument(doc.id);
      showToast('Document supprimé', 'success');
      reload();
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
  };

  // Group documents by category
  const grouped = documents.reduce((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  const filteredDocs = category === 'all' ? documents : (grouped[category] || []);

  // Stats
  const stats = DOC_CATEGORIES.map(c => ({
    ...c, count: (grouped[c.key] || []).length,
  })).filter(c => c.count > 0);

  const isEmbedded = !!dossierId;

  return (
    <div style={isEmbedded ? {} : { maxWidth: 1100, margin: '0 auto' }}>
      {/* CSS keyframe for spinner */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header — only in standalone mode */}
      {!isEmbedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.025em', marginBottom: 4 }}>
              📂 GED — Gestion Electronique de Documents
            </h2>
            <p style={{ color: 'var(--tx3)', fontSize: 13 }}>
              Stockage, classement automatique et prévisualisation de tous vos documents
            </p>
          </div>
        </div>
      )}

      {/* Dossier selector — standalone mode */}
      {!isEmbedded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx4)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="srch" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un document..." style={{ paddingLeft: 30 }} />
          </div>
          <select className="fsel" style={{ padding: '8px 10px' }} value={selectedDossier}
            onChange={e => setSelectedDossier(e.target.value)}>
            <option value="">— Tous les dossiers —</option>
            {dossiers.map(d => (
              <option key={d.id} value={d.id}>{d.client} ({d.id})</option>
            ))}
          </select>
          <button className="btn btn-s btn-sm" onClick={reload}>↺ Actualiser</button>
        </div>
      )}

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className={`btn btn-sm ${category === 'all' ? 'btn-p' : 'btn-s'}`}
          onClick={() => setCategory('all')}>
          Tous {documents.length > 0 && `(${documents.length})`}
        </button>
        {DOC_CATEGORIES.map(c => {
          const cnt = (grouped[c.key] || []).length;
          if (!isEmbedded && cnt === 0) return null;
          return (
            <button key={c.key}
              className={`btn btn-sm ${category === c.key ? 'btn-p' : 'btn-s'}`}
              onClick={() => setCategory(c.key)}
              style={category === c.key ? {} : { borderColor: c.color + '60', color: c.color }}>
              {c.icon} {c.label} {cnt > 0 && `(${cnt})`}
            </button>
          );
        })}
      </div>

      {/* Extraction banner */}
      {extractedBanner && (
        <ExtractionBanner
          data={extractedBanner.data}
          onApply={handleApplyExtracted}
          onDismiss={() => setExtractedBanner(null)}
        />
      )}

      {/* Drop zones — one per category (when dossier is selected) */}
      {effectiveDossierId && (
        <div style={{ marginBottom: 20 }}>
          {/* Show drop zone for currently selected category */}
          {category !== 'all' && (
            <DropZone
              dossierId={effectiveDossierId}
              category={category}
              onUploaded={handleUploaded}
              onExtracted={handleExtracted}
            />
          )}
          {/* In standalone mode with "all" selected, show a general drop zone */}
          {category === 'all' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 16 }}>
              {DOC_CATEGORIES.slice(0, 6).map(c => (
                <button key={c.key}
                  className="btn btn-s"
                  style={{ flexDirection: 'column', gap: 4, padding: '10px', height: 'auto',
                    borderColor: c.color + '50', justifyContent: 'center' }}
                  onClick={() => setCategory(c.key)}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span style={{ fontSize: 11 }}>Ajouter {c.label}</span>
                  {(c.extractDP || c.extractKbis) && (
                    <span style={{ fontSize: 9, color: '#1A4A8A', background: '#EEF3FD',
                      padding: '1px 5px', borderRadius: 8 }}>🔍 Auto</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!effectiveDossierId && !isEmbedded && (
        <div style={{ background: 'var(--bg3)', border: '2px dashed var(--bd2)', borderRadius: 10,
          padding: '24px', textAlign: 'center', color: 'var(--tx4)', marginBottom: 16, fontSize: 13 }}>
          Sélectionnez un dossier pour uploader des documents
        </div>
      )}

      {/* Documents list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx4)' }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--or)', borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
          Chargement...
        </div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx4)', fontSize: 13 }}>
          {effectiveDossierId ? 'Aucun document dans cette catégorie.' : 'Aucun document trouvé.'}
        </div>
      ) : category === 'all' ? (
        // Grouped by category
        DOC_CATEGORIES.map(c => {
          const docs = grouped[c.key] || [];
          if (docs.length === 0) return null;
          return (
            <div key={c.key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase',
                letterSpacing: '.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{c.icon}</span> {c.label}
                <span style={{ background: 'var(--bg3)', border: '1px solid var(--bd)',
                  borderRadius: 20, padding: '1px 8px', fontSize: 10 }}>{docs.length}</span>
              </div>
              {docs.map(doc => (
                <DocRow key={doc.id} doc={doc}
                  onPreview={setPreviewing}
                  onDelete={handleDelete}
                  onVersions={setVersioning}
                  onRename={() => {}} />
              ))}
            </div>
          );
        })
      ) : (
        // Flat list for single category
        filteredDocs.map(doc => (
          <DocRow key={doc.id} doc={doc}
            onPreview={setPreviewing}
            onDelete={handleDelete}
            onVersions={setVersioning}
            onRename={() => {}} />
        ))
      )}

      {/* Stats bar */}
      {stats.length > 0 && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg3)',
          border: '1.5px solid var(--bd)', borderRadius: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)', fontWeight: 700 }}>
            {documents.length} document{documents.length > 1 ? 's' : ''}
          </span>
          {stats.map(s => (
            <span key={s.key} style={{ fontSize: 11, color: s.color }}>
              {s.icon} {s.label}: {s.count}
            </span>
          ))}
        </div>
      )}

      {/* Modals */}
      {previewing && <PDFPreview doc={previewing} onClose={() => setPreviewing(null)} />}
      {versioning && <VersionsModal docId={versioning.id} onClose={() => setVersioning(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#fff', padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
