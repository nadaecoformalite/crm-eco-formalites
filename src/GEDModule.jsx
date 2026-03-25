import { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import {
  getDocuments, uploadDocuments, deleteDocument,
  updateDocument, getDocumentVersions, applyExtractedData,
} from "./api.js";
import PDFEditor from "./PDFEditor.jsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).toString();

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// ── Document categories ───────────────────────────────────────────────────────

export const DOC_CATEGORIES = [
  { key: 'dp',            label: 'Demande Préalable', icon: '🏛️', color: '#6366f1', bg: '#eef2ff', extractDP: true },
  { key: 'recepisse',     label: 'Récépissé de dépôt', icon: '📨', color: '#059669', bg: '#ecfdf5', extractDP: true },
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

// ── Extraction helpers (PDF text + OCR images/scannés) ───────────────────────

// Extrait le texte embarqué d'un PDF via pdfjs
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

// OCR sur une image (File blob ou data URL) via Tesseract.js
async function ocrFromImage(imageSource) {
  const { data: { text } } = await Tesseract.recognize(imageSource, 'fra', {
    logger: () => {},
  });
  return text || '';
}

// OCR sur un PDF scanné : rend chaque page en canvas puis OCR
async function ocrFromScannedPDF(file, maxPages = 3) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  let fullText = '';

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // haute résolution pour meilleure OCR
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    const pageText = await ocrFromImage(dataUrl);
    fullText += pageText + '\n';
  }
  return fullText;
}

/**
 * Extraction de texte universelle :
 * - Image (JPEG, PNG, WebP) → OCR directe
 * - PDF avec texte embarqué → pdfjs (rapide)
 * - PDF scanné (sans texte) → render → OCR
 */
async function extractText(file, maxPages = 3) {
  const isImage = file.type?.startsWith('image/');

  if (isImage) {
    return await ocrFromImage(file);
  }

  // PDF : tente d'abord l'extraction texte native
  const pdfText = await extractTextFromPDF(file);
  const stripped = pdfText.replace(/\s/g, '');
  // Si le PDF contient très peu de texte (<30 car), c'est probablement un scan
  if (stripped.length < 30) {
    return await ocrFromScannedPDF(file, maxPages);
  }
  return pdfText;
}

// Détecte si un nom de fichier correspond à un récépissé de dépôt
function isRecepisseFile(filename) {
  const n = (filename || '').toLowerCase().replace(/[_\-\s.]/g, '');
  return /rec[eé]piss[eé]/.test(n)
    || /\brd\b/.test((filename || '').toLowerCase())
    || n.startsWith('rd')
    || /recepisse/.test(n)
    || /recepisee/.test(n)
    || /accusedereception/.test(n);
}

async function extractDPNumber(file) {
  try {
    const txt = await extractText(file);
    // Patterns du plus spécifique au plus souple
    const pats = [
      // Format standard : DP 075 111 24 00001 (3+3+2+5 chiffres)
      /DP[\s\-\.\/]?(\d{3})[\s\-\.\/]?(\d{3})[\s\-\.\/]?(\d{2})[\s\-\.\/]?(\d{5})/gi,
      // Variante chiffres : DP 075 111 2400 001
      /DP[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2,4}[\s\-]?\d{3,6}/gi,
      // DP + 13 chiffres groupés
      /\bDP\s{0,3}\d[\d\s\-]{10,18}\d\b/gi,
      // Format code commune 5 chiffres : DP 76640 26 U0007 (5+2+lettre+chiffres)
      /\bDP[°]?\s{0,3}\d{5}[\s\-]?\d{2}[\s\-]?[A-Z][\dA-Z]{0,5}/gi,
      // Format avec lettres : DP 013 055 24 AB001
      /(?:N°\s*)?DP[°]?\s{0,3}(\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{2,5})/gi,
      // Format mixte 7+lettre+5 : DP 0751112L00001
      /(?:N°\s*)?DP[°]?\s{0,3}(\d{7}[A-Z]\d{5})/gi,
      // N° DP générique alphanumérique
      /N[°o]\s*DP\s{0,3}([\dA-Z][\dA-Z\s\-]{9,17}[\dA-Z])/gi,
      // Ultra-souple : DP suivi de 10+ caractères alphanum avec espaces/tirets
      /\bDP[°]?\s{1,3}[\dA-Z][\dA-Z\s\-]{8,20}[\dA-Z]\b/gi,
    ];
    for (const p of pats) {
      const m = txt.match(p);
      if (m) {
        const raw = m[0].trim();
        const digits = raw.replace(/[^0-9]/g, '');
        // 13 chiffres purs sans lettres → format standard 3+3+2+5
        if (digits.length >= 13 && !/[A-Z]/i.test(raw.replace(/^.*?DP[°]?\s*/i, '').replace(/[\s\-\.\/]/g, '').slice(0, 13)))
          return `DP ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,8)} ${digits.slice(8,13)}`;
        // Sinon garder le match brut (avec lettres, format commune 5 chiffres, etc.)
        return raw.replace(/\s+/g, ' ').slice(0, 50);
      }
    }
    return null;
  } catch { return null; }
}

async function extractKbisData(file) {
  try {
    const raw = await extractText(file, 2);

    // Normalise : collapse whitespace excessif tout en gardant les sauts de ligne
    const text = raw
      .split('\n')
      .map(l => l.replace(/\s{2,}/g, ' ').trim())
      .filter(l => l.length > 0)
      .join('\n');

    const lines = text.split('\n');

    // ── Helper : chercher la valeur qui suit un libellé ──
    // Retourne UNIQUEMENT la valeur sur la même ligne (après le séparateur) ou la ligne suivante
    function after(labelPattern) {
      for (let i = 0; i < lines.length; i++) {
        const re = new RegExp(labelPattern, 'i');
        if (!re.test(lines[i])) continue;
        // Valeur après le label sur la même ligne (après : ou espace)
        const inlineRe = new RegExp(labelPattern + '[\\s:;–\\-]*(.+)', 'i');
        const m = lines[i].match(inlineRe);
        if (m) {
          const v = m[1].trim().replace(/^[:;–\-\s]+/, '');
          if (v.length > 1) return v;
        }
        // Sinon prendre la ligne suivante
        if (i + 1 < lines.length) {
          const next = lines[i + 1].trim().replace(/^[:;–\-\s]+/, '');
          if (next.length > 1) return next;
        }
        return null;
      }
      return null;
    }

    // ── 1. Dénomination sociale → Nom entreprise ──────────────────────────
    let company_name =
      after('D[eé]nomination\\s+sociale') ||
      after('D[eé]nomination') ||
      after('Raison\\s+sociale') ||
      null;
    if (company_name) {
      // Retirer le préfixe "ou raison sociale" / "ou dénomination" qui traîne
      company_name = company_name
        .replace(/^.*(?:raison\s+sociale|d[eé]nomination\s+sociale?)\s*/i, '')
        // Couper dès qu'un label de champ suivant apparaît
        .replace(/\b(Forme\s+juridique|Forme|SIREN|SIRET|Capital|Adresse|Activit|Immatricul|Greffe|Date|Dur[eé]e|Enseigne|Sigle|Nom\s+commercial|Domiciliation|Num[eé]ro|N°|Objet).*/i, '')
        .replace(/\.{2,}/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    // ── 2. SIRET / SIREN ────────────────────────────────────────────────
    let siret = null;
    // Cherche dans le bloc "Immatriculation au RCS"
    const rcsIdx = lines.findIndex(l => /Immatriculation\s+au\s+RCS/i.test(l));
    if (rcsIdx >= 0) {
      const block = lines.slice(rcsIdx, rcsIdx + 3).join(' ');
      const numM = block.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}(?:[\s.]?\d{5})?)\b/);
      if (numM) {
        const digits = numM[1].replace(/[\s.]/g, '');
        if (digits.length === 14) {
          siret = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
        } else if (digits.length === 9) {
          siret = digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        }
      }
    }
    // Fallback : SIRET 14 chiffres n'importe où
    if (!siret) {
      const fallback = text.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/);
      if (fallback) {
        const d = fallback[1].replace(/[\s.]/g, '');
        siret = d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
      }
    }

    // ── 3. Adresse du siège ─────────────────────────────────────────────
    let address =
      after('Adresse\\s+du\\s+si[èe]ge\\s+social') ||
      after('Adresse\\s+du\\s+si[èe]ge') ||
      after('Si[èe]ge\\s+social') ||
      null;
    // Nettoyage : ne garder que l'adresse (couper avant les champs suivants)
    if (address) {
      // Si l'adresse ne contient pas de code postal, concaténer la ligne suivante
      if (address && !/\d{5}/.test(address)) {
        const idx = lines.findIndex(l => /Si[èe]ge|Adresse\s+du\s+si[èe]ge/i.test(l));
        if (idx >= 0 && idx + 2 < lines.length) {
          const extra = lines[idx + 2].trim();
          if (/\d{5}/.test(extra)) address = address + ' ' + extra;
        }
      }
      address = address
        // Couper dès qu'un label de champ suivant ou mot parasite apparaît
        .replace(/\b(Domiciliation|Activit|Forme|Capital|Dur[eé]e|Date|Greffe|Immatricul|SIREN|SIRET|Repr[eé]sentant|G[eé]rant|Pr[eé]sident|Nom\s+ou|Enseigne|Objet|Description|en\s+commun).*/i, '')
        .replace(/\.{2,}/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    // ── 4. Représentant légal → Nom Prénom uniquement ───────────────────
    let representant = null;
    // Chercher "Nom, prénoms" suivi du vrai nom (format KBIS courant)
    const nomPrenomMatch = text.match(/Nom,?\s*pr[eé]noms?\s*[:\s]*([A-ZÀ-Ü]{2,}(?:[\s\-]+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s\-]+[A-ZÀ-Ü][a-zà-ü]+)*)/i);
    if (nomPrenomMatch) {
      representant = nomPrenomMatch[1] + ' ' + nomPrenomMatch[2];
    }

    if (!representant) {
      // Chercher les lignes contenant le rôle puis extraire le nom
      const rolePatterns = [
        /Repr[eé]sentant(?:s)?\s+l[eé]gaux?/i,
        /G[eé]rant/i,
        /Pr[eé]sident/i,
        /Directeur\s+g[eé]n[eé]ral/i,
        /Dirigeant/i,
      ];
      for (const rolePat of rolePatterns) {
        const idx = lines.findIndex(l => rolePat.test(l));
        if (idx < 0) continue;

        // Chercher le nom dans les lignes proches (même ligne ou les 3 suivantes)
        const block = lines.slice(idx, idx + 4).join('\n');

        // Chercher "Nom, prénoms NOM Prénom" dans le bloc
        const npMatch = block.match(/Nom,?\s*pr[eé]noms?\s*[:\s]*([A-ZÀ-Ü]{2,}(?:[\s\-]+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s\-]+[A-ZÀ-Ü][a-zà-ü]+)*)/i);
        if (npMatch) { representant = npMatch[1] + ' ' + npMatch[2]; break; }

        // Chercher "Civilité + Nom" (M. / Mme / Mr)
        const civMatch = block.match(/\b(?:M[me.r]{0,3}|Madame|Monsieur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*(?:\s+[A-ZÀ-Ü]{2,})?)/);
        if (civMatch) { representant = civMatch[1].trim(); break; }

        // Pattern : "NOM Prénom" (NOM tout en majuscules)
        const nameMatch = block.match(/\b([A-ZÀ-Ü]{2,}(?:\s+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s-][A-ZÀ-Ü][a-zà-ü]+)*)\b/);
        if (nameMatch) { representant = nameMatch[1] + ' ' + nameMatch[2]; break; }

        // Fallback : prendre la ligne suivante si elle ressemble à un nom (2-4 mots, pas de chiffres)
        if (idx + 1 < lines.length) {
          const next = lines[idx + 1].trim().replace(/^[:;–\-\s]+/, '');
          if (next && /^[A-ZÀ-Üa-zà-ü\s\-'.]{2,60}$/.test(next) && !/\d/.test(next) && next.split(/\s+/).length <= 5) {
            representant = next;
            break;
          }
        }
      }
    }
    // Nettoyage final du représentant
    if (representant) {
      representant = representant
        // Retirer préfixe "Nom, prénoms" résiduel
        .replace(/^.*Nom,?\s*pr[eé]noms?\s*/i, '')
        .replace(/\b(n[eé]e?\s+le|dat[eé]|depuis|nomm[eé]|Adresse|Activit|Forme|Capital|Greffe|Immatricul|SIREN|Nationalit|Domiciliation).*/i, '')
        .replace(/,.*/, '')
        .replace(/\.{2,}/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    // ── Nettoyage global ────────────────────────────────────────────────
    const clean = v => {
      if (!v) return null;
      let c = v.replace(/\.{2,}/g, '').replace(/^\W+/, '').replace(/\s{2,}/g, ' ').trim();
      // Retirer si le résultat est trop court ou ne contient que des caractères spéciaux
      if (c.length < 2 || /^[\W\d]+$/.test(c)) return null;
      return c;
    };

    return {
      siret:        siret || null,
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
          <span style={{ color: '#6B6B60' }}>Nom entreprise : </span><strong>{kbis.company_name}</strong>
        </div>
      )}
      {kbis?.address && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Adresse : </span><strong>{kbis.address}</strong>
        </div>
      )}
      {kbis?.representant && (
        <div style={{ fontSize: 12, color: '#1A1A16', marginBottom: 2 }}>
          <span style={{ color: '#6B6B60' }}>Représentant : </span><strong>{kbis.representant}</strong>
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

    for (const file of files) {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type?.startsWith('image/');
      // Extraction uniquement sur PDF et images (pas sur .doc, .xls, etc.)
      if (!isPdf && !isImage) continue;

      const isRD = isRecepisseFile(file.name);

      // Extraction DP : catégorie "dp"/"recepisse" OU fichier récépissé (RD/rd/recepisse)
      const isRecepisseCat = category === 'recepisse';
      if (catDef.extractDP || isRD) {
        setProgress(isImage
          ? `🔍 OCR en cours — extraction N° DP depuis image...`
          : (isRD || isRecepisseCat)
            ? `📄 Récépissé détecté — extraction N° DP...`
            : 'Extraction du N° DP...');
        const dp = await extractDPNumber(file);
        if (dp) {
          extractedData = { ...extractedData, dp_number: dp };
          if (isRD || isRecepisseCat) extractedData = { ...extractedData, forceApply: true };
        }
      }

      if (catDef.extractKbis) {
        setProgress(isImage
          ? '🔍 OCR en cours — extraction données KBIS depuis image...'
          : 'Extraction des données KBIS...');
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
          <div style={{ fontSize: 24, marginBottom: 6, opacity: .7 }}>📂</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--or)' }}>
            Glissez vos fichiers ici
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 3 }}>
            ou cliquez pour sélectionner · PDF, images, documents · 20 MB max
          </div>
          {catDef?.extractDP && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--or)', background: 'var(--or-l)',
              padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>
              N° DP extrait automatiquement (PDF, images, scans OCR)
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--or)', background: 'var(--or-l)',
            padding: '3px 9px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>
            Fichier nommé RD / récépissé → N° DP extrait automatiquement
          </div>
          {catDef?.extractKbis && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--or)', background: 'var(--or-l)',
              padding: '4px 10px', borderRadius: 20, display: 'inline-block', fontWeight: 600 }}>
              Nom, adresse, représentant extraits automatiquement (PDF, images, scans OCR)
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Document thumbnail (grid card) ───────────────────────────────────────────

function DocCard({ doc, onPreview, onEdit, onDelete, onVersions }) {
  const isPdf = (doc.mime_type || '').includes('pdf') || (doc.original_name || doc.name || '').toLowerCase().endsWith('.pdf');
  const isImage = doc.mime_type?.startsWith('image/');
  const cat = catMap[doc.category] || catMap.autre;
  const canvasRef = useRef(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);

  // Generate PDF thumbnail
  useEffect(() => {
    if (!isPdf || !canvasRef.current) return;
    const url = `${API_BASE}${doc.url}`;
    pdfjsLib.getDocument(url).promise.then(pdf => {
      pdf.getPage(1).then(page => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: 0.5 });
        const ratio = 180 / viewport.width;
        const scaledViewport = page.getViewport({ scale: ratio });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise
          .then(() => setThumbLoaded(true));
      });
    }).catch(() => {});
  }, [isPdf, doc.url]);

  return (
    <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--bd)', borderRadius: 'var(--rl)',
      overflow: 'hidden', transition: 'all .2s', cursor: 'pointer', boxShadow: 'var(--sh)',
      display: 'flex', flexDirection: 'column' }}
      onClick={() => onPreview(doc)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shm)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--sh)'; e.currentTarget.style.transform = 'none'; }}>
      {/* Thumbnail area */}
      <div style={{ height: 140, background: '#1a1a18', display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {isImage ? (
          <img src={`${API_BASE}${doc.url}`} alt={doc.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : isPdf ? (
          <>
            <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', display: thumbLoaded ? 'block' : 'none' }} />
            {!thumbLoaded && <FileIcon mime={doc.mime_type} size={48} />}
          </>
        ) : (
          <FileIcon mime={doc.mime_type} size={48} />
        )}
        {/* Category badge */}
        <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontWeight: 700,
          color: cat.color, background: cat.bg, padding: '2px 7px', borderRadius: 6,
          border: `1px solid ${cat.color}30` }}>
          {cat.icon} {cat.label}
        </span>
        {doc.version > 1 && (
          <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700,
            color: 'var(--or)', background: 'var(--or-l)', padding: '2px 6px', borderRadius: 6 }}>
            v{doc.version}
          </span>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', color: 'var(--tx)' }}>
          {doc.original_name || doc.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx4)' }}>
          <span>{doc.size_human}</span>
          <span>{new Date(doc.created).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      {/* Actions */}
      <div style={{ padding: '6px 10px 10px', display: 'flex', gap: 4, borderTop: '1px solid var(--bd)' }}
        onClick={e => e.stopPropagation()}>
        <button className="bic" title="Aperçu" onClick={() => onPreview(doc)}
          style={{ width: 26, height: 26, fontSize: 11, flex: 1 }}>👁</button>
        {isPdf && <button className="bic" title="Éditer" onClick={() => onEdit(doc)}
          style={{ width: 26, height: 26, fontSize: 11, flex: 1, color: 'var(--or)' }}>✏️</button>}
        <a href={`${API_BASE}${doc.url}`} download={doc.original_name || doc.name}
          className="bic" title="Télécharger"
          style={{ width: 26, height: 26, fontSize: 11, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⬇</a>
        <button className="bic" title="Versions" onClick={() => onVersions(doc)}
          style={{ width: 26, height: 26, fontSize: 11, flex: 1 }}>🕐</button>
        <button className="bic" title="Supprimer" onClick={() => onDelete(doc)}
          style={{ width: 26, height: 26, fontSize: 11, flex: 1, color: 'var(--re)' }}>🗑</button>
      </div>
    </div>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onPreview, onEdit, onDelete, onVersions, onRename }) {
  const isPdf = (doc.mime_type || '').includes('pdf') || (doc.original_name || doc.name || '').toLowerCase().endsWith('.pdf');
  const cat = catMap[doc.category] || catMap.autre;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: 'var(--bg2)', border: '1.5px solid var(--bd)', borderRadius: 'var(--r)',
      marginBottom: 6, transition: 'all .15s' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: cat.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onPreview(doc)}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx)' }}>
          {doc.original_name || doc.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--or)', background: 'var(--or-l)',
            padding: '1px 7px', borderRadius: 6 }}>{cat.label}</span>
          <span style={{ fontSize: 10, color: 'var(--tx4)' }}>{doc.size_human}</span>
          <span style={{ fontSize: 10, color: 'var(--tx4)' }}>
            {new Date(doc.created).toLocaleDateString('fr-FR')}
          </span>
          {doc.version > 1 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--or)', background: 'var(--or-l)',
              padding: '1px 6px', borderRadius: 6, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onVersions(doc); }}>
              v{doc.version}
            </span>
          )}
          {doc.uploaded_by && (
            <span style={{ fontSize: 10, color: 'var(--tx4)' }}>{doc.uploaded_by}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button className="bic" title="Aperçu" onClick={() => onPreview(doc)}
          style={{ width: 28, height: 28, fontSize: 12 }}>👁</button>
        {isPdf && <button className="bic" title="Éditer le PDF (signature, annotations...)" onClick={() => onEdit(doc)}
          style={{ width: 28, height: 28, fontSize: 12, color: 'var(--or)' }}>✏️</button>}
        <a href={`${API_BASE}${doc.url}`} download={doc.original_name || doc.name}
          className="bic" title="Télécharger" onClick={e => e.stopPropagation()}
          style={{ width: 28, height: 28, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⬇</a>
        <button className="bic" title="Versions" onClick={() => onVersions(doc)}
          style={{ width: 28, height: 28, fontSize: 12 }}>🕐</button>
        <button className="bic" title="Supprimer" onClick={() => onDelete(doc)}
          style={{ width: 28, height: 28, fontSize: 12, color: 'var(--re)' }}>🗑</button>
      </div>
    </div>
  );
}

// ── Preview Side Panel ────────────────────────────────────────────────────────

function PreviewPanel({ doc, onClose, onEdit, onDelete, onVersions, onReplace, effectiveDossierId, onUploaded, onExtracted }) {
  const canvasRef = useRef(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState(null);
  const replaceRef = useRef(null);

  const url = `${API_BASE}${doc.url}`;
  const isPdf = doc.mime_type === 'application/pdf';
  const isImage = doc.mime_type?.startsWith('image/');
  const cat = catMap[doc.category] || catMap.autre;

  useEffect(() => {
    setPageNum(1);
    setPdfDoc(null);
    if (!isPdf) return;
    pdfjsLib.getDocument(url).promise.then(pdf => {
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
    }).catch(() => {});
  }, [url, isPdf]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    pdfDoc.getPage(pageNum).then(page => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = canvas.parentElement?.clientWidth || 400;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min((maxW - 20) / baseViewport.width, 1.6);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: canvas.getContext('2d'), viewport });
    });
  }, [pdfDoc, pageNum]);

  const handleReplace = async (e) => {
    const files = e.target.files;
    if (!files?.length || !effectiveDossierId) return;
    try {
      await uploadDocuments(effectiveDossierId, Array.from(files), doc.category);
      if (onUploaded) onUploaded({ saved: Array.from(files) });
    } catch (err) { alert('Erreur : ' + err.message); }
    e.target.value = '';
  };

  return (
    <div style={{ width: 420, minWidth: 320, maxWidth: 480, background: 'var(--bg2)', borderLeft: '1.5px solid var(--bd)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1.5px solid var(--bd)', background: 'var(--bg3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <FileIcon mime={doc.mime_type} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.original_name || doc.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx4)', marginTop: 2 }}>
              {doc.size_human} · v{doc.version}
            </div>
          </div>
          <button className="bic" onClick={onClose} style={{ fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>
        {/* Metadata */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg,
            padding: '2px 8px', borderRadius: 6, border: `1px solid ${cat.color}30` }}>
            {cat.icon} {cat.label}
          </span>
          <span style={{ fontSize: 10, color: 'var(--tx4)', background: 'var(--bg3)',
            padding: '2px 8px', borderRadius: 6, border: '1px solid var(--bd)' }}>
            {new Date(doc.created).toLocaleDateString('fr-FR')}
          </span>
          {doc.uploaded_by && (
            <span style={{ fontSize: 10, color: 'var(--tx4)', background: 'var(--bg3)',
              padding: '2px 8px', borderRadius: 6, border: '1px solid var(--bd)' }}>
              {doc.uploaded_by}
            </span>
          )}
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <a href={url} download={doc.original_name || doc.name} target="_blank" rel="noreferrer"
            className="btn btn-p btn-sm" style={{ fontSize: 11, gap: 4 }}>
            <span>↓</span> Telecharger
          </a>
          {isPdf && (
            <button className="btn btn-s btn-sm" style={{ fontSize: 11 }} onClick={() => onEdit(doc)}>
              ✏ Editer
            </button>
          )}
          <button className="btn btn-s btn-sm" style={{ fontSize: 11 }} onClick={() => onVersions(doc)}>
            🕐 Versions
          </button>
          {effectiveDossierId && (
            <button className="btn btn-s btn-sm" style={{ fontSize: 11 }}
              onClick={() => replaceRef.current?.click()}>
              ↻ Remplacer
            </button>
          )}
          <button className="btn btn-sm" style={{ fontSize: 11, background: 'var(--re-l)', color: 'var(--re)',
            border: '1px solid var(--re)' }} onClick={() => onDelete(doc)}>
            ✕ Supprimer
          </button>
          <input ref={replaceRef} type="file" style={{ display: 'none' }} onChange={handleReplace}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt" />
        </div>
      </div>

      {/* Preview area */}
      <div style={{ flex: 1, overflow: 'auto', background: '#1a1a18', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', padding: 12 }}>
        {isImage && (
          <img src={url} alt={doc.name} style={{ maxWidth: '100%', borderRadius: 6 }} />
        )}
        {isPdf && (
          <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,.4)' }} />
        )}
        {!isImage && !isPdf && (
          <div style={{ color: '#fff', textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 12 }}>Apercu non disponible</div>
          </div>
        )}
      </div>

      {/* PDF pagination */}
      {isPdf && totalPages > 1 && (
        <div style={{ padding: '8px 16px', borderTop: '1.5px solid var(--bd)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg3)' }}>
          <button className="btn btn-s btn-sm" disabled={pageNum <= 1}
            onClick={() => setPageNum(p => p - 1)} style={{ minWidth: 28 }}>←</button>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{pageNum} / {totalPages}</span>
          <button className="btn btn-s btn-sm" disabled={pageNum >= totalPages}
            onClick={() => setPageNum(p => p + 1)} style={{ minWidth: 28 }}>→</button>
        </div>
      )}
    </div>
  );
}

// ── Main GEDModule ────────────────────────────────────────────────────────────

/**
 * GEDModule — Three-Pane Layout:
 *   Left: category sidebar | Center: file list | Right: preview panel
 *   Modes: standalone (all dossiers) or embedded (scoped to one dossier)
 */
export default function GEDModule({ dossierId = null, dossierData = null, dossiers = [], onDossierUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [selectedDossier, setSelectedDossier] = useState(dossierId || '');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editing, setEditing] = useState(null);
  const [versioning, setVersioning] = useState(null);
  const [extractedBanner, setExtractedBanner] = useState(null);
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
    showToast(`${result.saved.length} fichier(s) uploade(s)`, 'success');
    reload();
  }, [reload, showToast]);

  const handleExtracted = useCallback(async (data, dId) => {
    const hasData = data?.dp_number || data?.kbis?.siret || data?.kbis?.company_name;
    if (!hasData) return;
    if (data.forceApply && data.dp_number) {
      try {
        await applyExtractedData(dId, { dp_number: data.dp_number });
        if (onDossierUpdate) onDossierUpdate(dId, { dp_number: data.dp_number });
        showToast(`N° DP extrait du recepisse et enregistre : ${data.dp_number}`, 'success');
      } catch { showToast('Extraction DP reussie mais erreur d\'enregistrement', 'error'); }
      return;
    }
    setExtractedBanner({ data, dossierId: dId });
  }, [onDossierUpdate, showToast]);

  const handleApplyExtracted = async () => {
    if (!extractedBanner) return;
    try {
      await applyExtractedData(extractedBanner.dossierId, extractedBanner.data);
      showToast('Donnees appliquees au dossier', 'success');
      if (onDossierUpdate) onDossierUpdate(extractedBanner.dossierId, extractedBanner.data);
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
    setExtractedBanner(null);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Supprimer "${doc.original_name || doc.name}" ?`)) return;
    try {
      await deleteDocument(doc.id);
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      showToast('Document supprime', 'success');
      reload();
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
  };

  const grouped = documents.reduce((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  const filteredDocs = category === 'all' ? documents : (grouped[category] || []);

  const isEmbedded = !!dossierId;

  return (
    <div style={isEmbedded ? {} : { maxWidth: 1400, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      {!isEmbedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.025em', marginBottom: 4, color: 'var(--tx)' }}>
              GED — Gestion Electronique de Documents
            </h2>
            <p style={{ color: 'var(--tx3)', fontSize: 13 }}>
              Stockage, classement et previsualisation de tous vos documents
            </p>
          </div>
        </div>
      )}

      {/* Top bar: search + dossier selector */}
      {!isEmbedded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 14 }}>
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

      {/* Extraction banner */}
      {extractedBanner && (
        <ExtractionBanner data={extractedBanner.data}
          onApply={handleApplyExtracted} onDismiss={() => setExtractedBanner(null)} />
      )}

      {/* ═══ THREE-PANE LAYOUT ═══ */}
      <div style={{ display: 'flex', gap: 0, border: '1.5px solid var(--bd)', borderRadius: 'var(--rl)',
        overflow: 'hidden', background: 'var(--bg2)', minHeight: isEmbedded ? 400 : 520, boxShadow: 'var(--sh)' }}>

        {/* ── LEFT PANE: Category sidebar ── */}
        <div style={{ width: 200, minWidth: 180, background: 'var(--bg3)', borderRight: '1.5px solid var(--bd)',
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'auto' }}>
          <div style={{ padding: '14px 12px 8px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '.08em', color: 'var(--tx4)' }}>
            Categories
          </div>
          {/* All */}
          <button onClick={() => setCategory('all')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: 'none',
              background: category === 'all' ? 'var(--or-l)' : 'transparent', cursor: 'pointer',
              borderLeft: category === 'all' ? '3px solid var(--or)' : '3px solid transparent',
              transition: 'all .15s', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{ fontSize: 12, fontWeight: category === 'all' ? 700 : 500,
              color: category === 'all' ? 'var(--or)' : 'var(--tx2)', flex: 1 }}>
              Tous
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--or)', background: 'var(--or-l)',
              padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>
              {documents.length}
            </span>
          </button>
          {DOC_CATEGORIES.map(c => {
            const cnt = (grouped[c.key] || []).length;
            const active = category === c.key;
            return (
              <button key={c.key} onClick={() => setCategory(c.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: 'none',
                  background: active ? 'var(--or-l)' : 'transparent', cursor: 'pointer',
                  borderLeft: active ? '3px solid var(--or)' : '3px solid transparent',
                  transition: 'all .15s', width: '100%', textAlign: 'left' }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--or)' : 'var(--tx2)', flex: 1, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.label}
                </span>
                {cnt > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--or)' : 'var(--tx4)',
                    background: active ? 'var(--bg2)' : 'var(--bg)', padding: '1px 6px', borderRadius: 10,
                    minWidth: 18, textAlign: 'center' }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
          {/* Upload zone at bottom of sidebar */}
          {effectiveDossierId && category !== 'all' && (
            <div style={{ padding: '10px 10px', marginTop: 'auto', borderTop: '1.5px solid var(--bd)' }}>
              <DropZone dossierId={effectiveDossierId} category={category}
                onUploaded={handleUploaded} onExtracted={handleExtracted} />
            </div>
          )}
        </div>

        {/* ── CENTER PANE: File list (table) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Embedded search bar */}
          {isEmbedded && (
            <div style={{ padding: '10px 14px', borderBottom: '1.5px solid var(--bd)', background: 'var(--bg3)' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx4)', pointerEvents: 'none' }}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input className="srch" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher..." style={{ paddingLeft: 28, fontSize: 12, height: 32 }} />
              </div>
            </div>
          )}

          {/* Drop zone when "all" category and dossier selected */}
          {effectiveDossierId && category === 'all' && (
            <div style={{ padding: '8px 14px', borderBottom: '1.5px solid var(--bd)', background: 'var(--bg3)',
              display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DOC_CATEGORIES.slice(0, 6).map(c => (
                <button key={c.key} className="btn btn-s btn-sm"
                  style={{ fontSize: 10, gap: 3, padding: '4px 8px' }}
                  onClick={() => setCategory(c.key)}>
                  {c.icon} + {c.label}
                </button>
              ))}
            </div>
          )}

          {!effectiveDossierId && !isEmbedded && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx4)', fontSize: 13 }}>
              Selectionnez un dossier pour uploader des documents
            </div>
          )}

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 80px 70px', gap: 8,
            padding: '8px 14px', borderBottom: '1.5px solid var(--bd)', background: 'var(--bg3)',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx4)' }}>
            <span></span>
            <span>Nom</span>
            <span>Categorie</span>
            <span>Date</span>
            <span>Taille</span>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx4)' }}>
                <div style={{ width: 24, height: 24, border: '3px solid var(--or)', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                Chargement...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--tx4)', fontSize: 13 }}>
                {effectiveDossierId ? 'Aucun document dans cette categorie.' : 'Aucun document trouve.'}
              </div>
            ) : (
              filteredDocs.map(doc => {
                const cat = catMap[doc.category] || catMap.autre;
                const isActive = selectedDoc?.id === doc.id;
                return (
                  <div key={doc.id} onClick={() => setSelectedDoc(doc)}
                    style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 80px 70px', gap: 8,
                      padding: '10px 14px', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                      background: isActive ? 'var(--or-l)' : 'var(--bg2)',
                      borderLeft: isActive ? '3px solid var(--or)' : '3px solid transparent',
                      transition: 'all .1s' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg3)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg2)'; }}>
                    <FileIcon mime={doc.mime_type} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', color: isActive ? 'var(--or)' : 'var(--tx)' }}>
                        {doc.original_name || doc.name}
                      </div>
                      {doc.uploaded_by && (
                        <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 1 }}>{doc.uploaded_by}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, alignSelf: 'center' }}>
                      {cat.icon} {cat.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--tx4)', alignSelf: 'center' }}>
                      {new Date(doc.created).toLocaleDateString('fr-FR')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--tx4)', alignSelf: 'center' }}>
                      {doc.size_human}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Stats footer */}
          <div style={{ padding: '8px 14px', borderTop: '1.5px solid var(--bd)', background: 'var(--bg3)',
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--or)', fontWeight: 700 }}>
              {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''}
            </span>
            {category === 'all' && DOC_CATEGORIES.map(c => {
              const cnt = (grouped[c.key] || []).length;
              if (!cnt) return null;
              return (
                <span key={c.key} style={{ fontSize: 10, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {c.icon} {c.label}: <strong style={{ color: 'var(--tx2)' }}>{cnt}</strong>
                </span>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT PANE: Preview panel ── */}
        {selectedDoc ? (
          <PreviewPanel doc={selectedDoc}
            onClose={() => setSelectedDoc(null)}
            onEdit={setEditing}
            onDelete={handleDelete}
            onVersions={setVersioning}
            effectiveDossierId={effectiveDossierId}
            onUploaded={handleUploaded}
            onExtracted={handleExtracted} />
        ) : (
          <div style={{ width: 320, minWidth: 260, background: 'var(--bg3)', borderLeft: '1.5px solid var(--bd)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tx4)', flexShrink: 0, padding: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Aucun document selectionne</div>
            <div style={{ fontSize: 11, textAlign: 'center' }}>
              Cliquez sur un document dans la liste pour afficher son apercu
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {editing && <PDFEditor doc={editing} onClose={() => setEditing(null)}
        onSaveVersion={() => { setEditing(null); reload(); showToast('Version sauvegardee'); }} />}
      {versioning && <VersionsModal docId={versioning.id} onClose={() => setVersioning(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? 'var(--re)' : 'var(--gr)',
          color: '#fff', padding: '11px 18px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600,
          boxShadow: 'var(--shl)' }}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
