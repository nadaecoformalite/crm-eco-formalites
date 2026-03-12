import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// ── Load Fabric.js from CDN ────────────────────────────────────────────────────

let fabricLoadPromise = null;
async function loadFabric() {
  if (window.fabric) return window.fabric;
  if (fabricLoadPromise) return fabricLoadPromise;
  fabricLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
    script.onload = () => resolve(window.fabric);
    script.onerror = () => reject(new Error('Failed to load Fabric.js'));
    document.head.appendChild(script);
  });
  return fabricLoadPromise;
}

// ── Load JSZip from CDN ────────────────────────────────────────────────────────

let jsZipLoadPromise = null;
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  if (jsZipLoadPromise) return jsZipLoadPromise;
  jsZipLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
  return jsZipLoadPromise;
}

// ── Color palette ──────────────────────────────────────────────────────────────

const COLORS = [
  { label: 'Noir',   value: '#000000' },
  { label: 'Rouge',  value: '#e53e3e' },
  { label: 'Bleu',   value: '#3182ce' },
  { label: 'Vert',   value: '#38a169' },
  { label: 'Orange', value: '#dd6b20' },
  { label: 'Violet', value: '#805ad5' },
  { label: 'Jaune',  value: '#d69e2e' },
  { label: 'Blanc',  value: '#ffffff' },
];

// ── Tool icons (SVG strings) ───────────────────────────────────────────────────

const TOOLS = [
  { id: 'select',    label: 'Sélection', icon: '↖' },
  { id: 'pen',       label: 'Stylo',     icon: '✏️' },
  { id: 'line',      label: 'Ligne',     icon: '╱' },
  { id: 'rect',      label: 'Rectangle', icon: '▭' },
  { id: 'circle',    label: 'Cercle',    icon: '○' },
  { id: 'text',      label: 'Texte',     icon: 'T' },
  { id: 'highlight', label: 'Surligneur',icon: '▬' },
  { id: 'signature', label: 'Signature', icon: '🖊' },
  { id: 'eraser',    label: 'Gomme',     icon: '⌫' },
  { id: 'group',     label: 'Grouper',   icon: '⊞' },
  { id: 'ungroup',   label: 'Dégrouper', icon: '⊟' },
];

// ── Main PDFEditor component ───────────────────────────────────────────────────

export default function PDFEditor({ doc, onClose, onSaveVersion }) {
  const canvasElRef      = useRef(null);
  const fabricRef        = useRef(null);       // fabric.Canvas instance
  const fabricLibRef     = useRef(null);       // fabric lib
  const pdfDocRef        = useRef(null);       // pdfjs document
  const pagesDataRef     = useRef(new Map());  // pageNum -> fabric JSON
  const bgCanvasRef      = useRef(null);       // hidden canvas for PDF render
  const autosaveTimer    = useRef(null);
  const isDrawingShape   = useRef(false);
  const shapeOrigin      = useRef({ x: 0, y: 0 });
  const activeShapeRef   = useRef(null);
  const sigCanvasRef     = useRef(null);
  const sigDrawing       = useRef(false);
  const sigLastPos       = useRef({ x: 0, y: 0 });

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const [gotoPage, setGotoPage]       = useState('');
  const [zoom, setZoom]               = useState(1.0);
  const [tool, setTool]               = useState('select');
  const [color, setColor]             = useState('#000000');
  const [fillColor, setFillColor]     = useState('transparent');
  const [lineWidth, setLineWidth]     = useState(2);
  const [fontSize, setFontSize]       = useState(16);
  const [showSigModal, setShowSigModal]           = useState(false);
  const [showPageModal, setShowPageModal]         = useState(false);
  const [selectedPages, setSelectedPages]         = useState([]);
  const [pageRendering, setPageRendering]         = useState(false);
  const [savingGED, setSavingGED]                 = useState(false);
  const [statusMsg, setStatusMsg]                 = useState('');

  // ── Autosave helpers ─────────────────────────────────────────────────────────

  const persistToStorage = useCallback(() => {
    if (!pagesDataRef.current) return;
    try {
      const obj = {};
      pagesDataRef.current.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('ped:' + doc.name, JSON.stringify(obj));
    } catch (_) {}
  }, [doc.name]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(persistToStorage, 2000);
  }, [persistToStorage]);

  const restoreFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem('ped:' + doc.name);
      if (!raw) return;
      const obj = JSON.parse(raw);
      pagesDataRef.current = new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
    } catch (_) {}
  }, [doc.name]);

  // ── Apply fabric tool settings ───────────────────────────────────────────────

  const applyTool = useCallback((t, fc) => {
    const canvas = fc || fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = false;
    canvas.selection     = false;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor   = 'default';

    if (t === 'select') {
      canvas.selection   = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor   = 'move';
    } else if (t === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = lineWidth;
    } else if (t === 'eraser') {
      canvas.defaultCursor = 'cell';
      canvas.hoverCursor   = 'cell';
    } else {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor   = 'crosshair';
    }
  }, [color, lineWidth]);

  // Re-apply tool whenever tool/color/lineWidth changes
  useEffect(() => {
    applyTool(tool);
  }, [tool, color, lineWidth, applyTool]);

  // ── Render a PDF page onto the fabric canvas ─────────────────────────────────

  const renderPage = useCallback(async (pageNum) => {
    const pdfDoc = pdfDocRef.current;
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!pdfDoc || !canvas || !fabric) return;

    setPageRendering(true);
    try {
      const page    = await pdfDoc.getPage(pageNum);
      const vp      = page.getViewport({ scale: zoom });

      // Resize fabric canvas
      canvas.setWidth(vp.width);
      canvas.setHeight(vp.height);

      // Render PDF page to hidden bg canvas
      if (!bgCanvasRef.current) {
        bgCanvasRef.current = document.createElement('canvas');
      }
      const bg = bgCanvasRef.current;
      bg.width  = vp.width;
      bg.height = vp.height;
      const ctx = bg.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;

      // Set as fabric background image
      const bgImg = bg.toDataURL('image/jpeg', 0.95);
      await new Promise(resolve => {
        fabric.Image.fromURL(bgImg, (img) => {
          img.set({ selectable: false, evented: false, left: 0, top: 0 });
          canvas.setBackgroundImage(img, () => {
            canvas.renderAll();
            resolve();
          });
        });
      });

      // Restore annotations for this page
      const stored = pagesDataRef.current.get(pageNum);
      if (stored) {
        await new Promise(resolve => {
          canvas.loadFromJSON(stored, () => {
            // Re-apply bg image (loadFromJSON clears it)
            fabric.Image.fromURL(bgImg, (img) => {
              img.set({ selectable: false, evented: false, left: 0, top: 0 });
              canvas.setBackgroundImage(img, () => {
                canvas.renderAll();
                resolve();
              });
            });
          });
        });
      } else {
        canvas.clear();
        await new Promise(resolve => {
          fabric.Image.fromURL(bgImg, (img) => {
            img.set({ selectable: false, evented: false, left: 0, top: 0 });
            canvas.setBackgroundImage(img, () => {
              canvas.renderAll();
              resolve();
            });
          });
        });
      }

      applyTool(tool, canvas);
    } catch (err) {
      console.error('renderPage error', err);
    } finally {
      setPageRendering(false);
    }
  }, [zoom, tool, applyTool]);

  // ── Save current page annotations to map ────────────────────────────────────

  const saveCurrentPageAnnotations = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = canvas.toJSON();
    pagesDataRef.current.set(currentPage, json);
  }, [currentPage]);

  // ── Navigate pages ───────────────────────────────────────────────────────────

  const goToPage = useCallback(async (pageNum) => {
    if (!pdfDocRef.current) return;
    if (pageNum < 1 || pageNum > totalPages) return;
    saveCurrentPageAnnotations();
    setCurrentPage(pageNum);
    setGotoPage('');
  }, [totalPages, saveCurrentPageAnnotations]);

  // Render when currentPage or zoom changes
  useEffect(() => {
    if (pdfDocRef.current && fabricRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, zoom, renderPage]);

  // ── Fabric canvas mouse events for shapes ────────────────────────────────────

  const setupFabricEvents = useCallback((canvas, fabric) => {
    canvas.on('mouse:down', (e) => {
      const activeTool = tool;
      if (['line', 'rect', 'circle', 'highlight'].includes(activeTool)) {
        isDrawingShape.current = true;
        const pt = canvas.getPointer(e.e);
        shapeOrigin.current = { x: pt.x, y: pt.y };

        let shape;
        if (activeTool === 'line') {
          shape = new fabric.Line([pt.x, pt.y, pt.x, pt.y], {
            stroke: color, strokeWidth: lineWidth, selectable: false,
          });
        } else if (activeTool === 'rect') {
          shape = new fabric.Rect({
            left: pt.x, top: pt.y, width: 0, height: 0,
            stroke: color, strokeWidth: lineWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            selectable: false,
          });
        } else if (activeTool === 'circle') {
          shape = new fabric.Ellipse({
            left: pt.x, top: pt.y, rx: 0, ry: 0,
            stroke: color, strokeWidth: lineWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            selectable: false,
          });
        } else if (activeTool === 'highlight') {
          shape = new fabric.Rect({
            left: pt.x, top: pt.y, width: 0, height: 0,
            stroke: 'transparent', strokeWidth: 0,
            fill: 'rgba(255, 235, 59, 0.4)',
            selectable: false,
          });
        }
        if (shape) {
          canvas.add(shape);
          activeShapeRef.current = shape;
        }
      } else if (activeTool === 'text') {
        const pt = canvas.getPointer(e.e);
        const text = new fabric.IText('Texte', {
          left: pt.x, top: pt.y,
          fontSize, fill: color, fontFamily: 'Arial',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.renderAll();
        scheduleAutosave();
      } else if (activeTool === 'eraser') {
        const obj = canvas.findTarget(e.e);
        if (obj && obj !== canvas.backgroundImage) {
          canvas.remove(obj);
          canvas.renderAll();
          scheduleAutosave();
        }
      }
    });

    canvas.on('mouse:move', (e) => {
      if (!isDrawingShape.current || !activeShapeRef.current) return;
      const pt = canvas.getPointer(e.e);
      const origin = shapeOrigin.current;
      const shape = activeShapeRef.current;
      const activeTool = tool;

      if (activeTool === 'line') {
        shape.set({ x2: pt.x, y2: pt.y });
      } else if (activeTool === 'rect' || activeTool === 'highlight') {
        const w = pt.x - origin.x;
        const h = pt.y - origin.y;
        shape.set({
          left:   w < 0 ? pt.x   : origin.x,
          top:    h < 0 ? pt.y   : origin.y,
          width:  Math.abs(w),
          height: Math.abs(h),
        });
      } else if (activeTool === 'circle') {
        const rx = Math.abs(pt.x - origin.x) / 2;
        const ry = Math.abs(pt.y - origin.y) / 2;
        shape.set({
          left: Math.min(pt.x, origin.x),
          top:  Math.min(pt.y, origin.y),
          rx, ry,
        });
      }
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (isDrawingShape.current) {
        isDrawingShape.current = false;
        if (activeShapeRef.current) {
          activeShapeRef.current.set({ selectable: true });
          activeShapeRef.current = null;
          canvas.renderAll();
          scheduleAutosave();
        }
      }
    });

    canvas.on('path:created', () => {
      scheduleAutosave();
    });

    canvas.on('object:modified', () => {
      scheduleAutosave();
    });

    canvas.on('object:added', () => {
      scheduleAutosave();
    });
  }, [tool, color, lineWidth, fillColor, fontSize, scheduleAutosave]);

  // ── Delete key ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObjects();
        if (active && active.length > 0) {
          active.forEach(obj => {
            if (obj !== canvas.backgroundImage) canvas.remove(obj);
          });
          canvas.discardActiveObject();
          canvas.renderAll();
          scheduleAutosave();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scheduleAutosave]);

  // ── Initialize: load Fabric + PDF ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const fabric = await loadFabric();
        if (cancelled) return;
        fabricLibRef.current = fabric;

        // Build PDF URL
        let pdfUrl = doc.url;
        if (pdfUrl && !pdfUrl.startsWith('http')) {
          pdfUrl = API_BASE + pdfUrl;
        }

        // Load PDF
        const loadTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;
        setTotalPages(pdfDoc.numPages);
        setSelectedPages(Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1));

        // Restore autosaved data
        restoreFromStorage();

        // Initialize fabric canvas
        if (!canvasElRef.current) return;
        const fc = new fabric.Canvas(canvasElRef.current, {
          selection: true,
          preserveObjectStacking: true,
        });
        fabricRef.current = fc;
        setupFabricEvents(fc, fabric);

        setLoading(false);
        setCurrentPage(1);
        // renderPage triggered by currentPage effect
      } catch (err) {
        if (!cancelled) {
          console.error('PDFEditor init error', err);
          setError(err.message || 'Erreur de chargement');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.url]);

  // Re-setup events when tool/color/lineWidth change (canvas exists)
  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    // path:created, object:modified, object:added remain from init
    setupFabricEvents(canvas, fabric);
  }, [tool, color, lineWidth, fillColor, fontSize, setupFabricEvents]);

  // ── Merge page to PNG ─────────────────────────────────────────────────────────

  const mergePageToPNG = useCallback(async (pageNum) => {
    const pdfDoc = pdfDocRef.current;
    const fabric = fabricLibRef.current;
    if (!pdfDoc || !fabric) return null;

    const page = await pdfDoc.getPage(pageNum);
    const vp   = page.getViewport({ scale: zoom });

    const bgC  = document.createElement('canvas');
    bgC.width  = vp.width;
    bgC.height = vp.height;
    await page.render({ canvasContext: bgC.getContext('2d'), viewport: vp }).promise;

    // Temporary fabric canvas
    const tempEl = document.createElement('canvas');
    tempEl.width  = vp.width;
    tempEl.height = vp.height;
    const tempFc  = new fabric.Canvas(tempEl, { width: vp.width, height: vp.height });

    const bgImgData = bgC.toDataURL('image/jpeg', 0.95);
    await new Promise(resolve => {
      fabric.Image.fromURL(bgImgData, (img) => {
        img.set({ selectable: false, evented: false, left: 0, top: 0 });
        tempFc.setBackgroundImage(img, () => { tempFc.renderAll(); resolve(); });
      });
    });

    const stored = pagesDataRef.current.get(pageNum);
    if (stored) {
      await new Promise(resolve => {
        tempFc.loadFromJSON(stored, () => {
          fabric.Image.fromURL(bgImgData, (img) => {
            img.set({ selectable: false, evented: false, left: 0, top: 0 });
            tempFc.setBackgroundImage(img, () => { tempFc.renderAll(); resolve(); });
          });
        });
      });
    }

    const merged = document.createElement('canvas');
    merged.width  = vp.width;
    merged.height = vp.height;
    const ctx = merged.getContext('2d');
    ctx.drawImage(bgC, 0, 0);
    ctx.drawImage(tempEl, 0, 0);

    tempFc.dispose();
    return merged.toDataURL('image/png');
  }, [zoom]);

  // ── Save current page ────────────────────────────────────────────────────────

  const handleSaveCurrentPage = useCallback(async () => {
    saveCurrentPageAnnotations();
    setStatusMsg('Génération PNG...');
    const dataUrl = await mergePageToPNG(currentPage);
    if (!dataUrl) { setStatusMsg('Erreur'); return; }
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = `${doc.name}_page${currentPage}.png`;
    a.click();
    setStatusMsg('Téléchargé !');
    setTimeout(() => setStatusMsg(''), 2000);
  }, [currentPage, doc.name, mergePageToPNG, saveCurrentPageAnnotations]);

  // ── Save selected pages as ZIP ───────────────────────────────────────────────

  const handleSavePages = useCallback(async () => {
    saveCurrentPageAnnotations();
    if (selectedPages.length === 0) return;
    setStatusMsg('Génération ZIP...');
    try {
      const JSZip = await loadJSZip();
      const zip   = new JSZip();
      for (const pn of selectedPages) {
        const dataUrl = await mergePageToPNG(pn);
        if (!dataUrl) continue;
        const base64 = dataUrl.split(',')[1];
        zip.file(`${doc.name}_page${pn}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${doc.name}_pages.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setShowPageModal(false);
      setStatusMsg('ZIP téléchargé !');
      setTimeout(() => setStatusMsg(''), 2000);
    } catch (err) {
      console.error(err);
      setStatusMsg('Erreur ZIP');
    }
  }, [selectedPages, doc.name, mergePageToPNG, saveCurrentPageAnnotations]);

  // ── Save new GED version ─────────────────────────────────────────────────────

  const handleSaveGED = useCallback(async () => {
    if (!onSaveVersion) return;
    saveCurrentPageAnnotations();
    setSavingGED(true);
    setStatusMsg('Génération...');
    try {
      const dataUrl = await mergePageToPNG(currentPage);
      if (!dataUrl) throw new Error('Merge failed');
      const res   = await fetch(dataUrl);
      const blob  = await res.blob();
      const fname = `${doc.name}_annote_p${currentPage}.png`;
      await onSaveVersion(blob, fname);
      setStatusMsg('Version GED sauvegardée !');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setStatusMsg('Erreur GED');
    } finally {
      setSavingGED(false);
    }
  }, [currentPage, doc.name, mergePageToPNG, onSaveVersion, saveCurrentPageAnnotations]);

  // ── Grouper / Dégrouper ─────────────────────────────────────────────────────

  const handleGroup = useCallback(() => {
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!canvas || !fabric) return;
    const activeSelection = canvas.getActiveObject();
    if (!activeSelection || activeSelection.type !== 'activeSelection') return;
    activeSelection.toGroup();
    canvas.requestRenderAll();
    scheduleAutosave();
  }, [scheduleAutosave]);

  const handleUngroup = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'group') return;
    activeObject.toActiveSelection();
    canvas.requestRenderAll();
    scheduleAutosave();
  }, [scheduleAutosave]);

  // ── Annuler tout (reset current page) ───────────────────────────────────────

  const handleUndoAll = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    pagesDataRef.current.delete(currentPage);
    persistToStorage();
    renderPage(currentPage);
  }, [currentPage, persistToStorage, renderPage]);

  // ── Signature modal logic ────────────────────────────────────────────────────

  const initSigCanvas = useCallback(() => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    if (showSigModal) {
      setTimeout(() => initSigCanvas(), 50);
    }
  }, [showSigModal, initSigCanvas]);

  const getSigPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const onSigStart = (e) => {
    e.preventDefault();
    sigDrawing.current = true;
    const pos = getSigPos(e, sigCanvasRef.current);
    sigLastPos.current = pos;
    const ctx = sigCanvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const onSigMove = (e) => {
    e.preventDefault();
    if (!sigDrawing.current) return;
    const c   = sigCanvasRef.current;
    const ctx = c.getContext('2d');
    const pos = getSigPos(e, c);
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    sigLastPos.current = pos;
  };

  const onSigEnd = (e) => {
    e.preventDefault();
    sigDrawing.current = false;
  };

  const clearSignature = () => {
    initSigCanvas();
  };

  const applySignature = () => {
    const c      = sigCanvasRef.current;
    const canvas = fabricRef.current;
    const fabric = fabricLibRef.current;
    if (!c || !canvas || !fabric) return;
    const dataUrl = c.toDataURL('image/png');
    fabric.Image.fromURL(dataUrl, (img) => {
      img.set({ left: 50, top: 50, scaleX: 0.5, scaleY: 0.5 });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      scheduleAutosave();
    });
    setShowSigModal(false);
  };

  // ── Styles ────────────────────────────────────────────────────────────────────

  const styles = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg, #1a1a2e)',
      color: 'var(--text, #e2e8f0)',
      fontFamily: 'system-ui, sans-serif',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'var(--bg2, #16213e)',
      borderBottom: '1px solid var(--bd, #2d3748)',
      flexShrink: 0,
      flexWrap: 'wrap',
    },
    headerTitle: {
      fontWeight: 700, fontSize: 14, marginRight: 8,
      color: 'var(--or, #f6ad55)',
      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    },
    actionBtn: {
      padding: '5px 10px', borderRadius: 5, border: 'none',
      cursor: 'pointer', fontSize: 12, fontWeight: 600,
      background: 'var(--or, #f6ad55)', color: '#1a1a2e',
      transition: 'opacity 0.15s',
    },
    actionBtnSecondary: {
      padding: '5px 10px', borderRadius: 5, border: '1px solid var(--bd, #2d3748)',
      cursor: 'pointer', fontSize: 12, fontWeight: 600,
      background: 'var(--bg2, #16213e)', color: 'var(--text, #e2e8f0)',
    },
    actionBtnDanger: {
      padding: '5px 10px', borderRadius: 5, border: 'none',
      cursor: 'pointer', fontSize: 12, fontWeight: 600,
      background: '#e53e3e', color: '#fff',
    },
    closeBtn: {
      marginLeft: 'auto',
      padding: '5px 12px', borderRadius: 5, border: 'none',
      cursor: 'pointer', fontSize: 14, fontWeight: 700,
      background: '#e53e3e', color: '#fff',
    },
    body: {
      display: 'flex', flex: 1, overflow: 'hidden',
    },
    sidebar: {
      width: 70, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'var(--bg2, #16213e)',
      borderRight: '1px solid var(--bd, #2d3748)',
      padding: '8px 0', gap: 2, overflowY: 'auto',
    },
    toolBtn: (active) => ({
      width: 56, padding: '6px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      borderRadius: 6, border: 'none',
      cursor: 'pointer', fontSize: 18,
      background: active ? 'var(--or, #f6ad55)' : 'transparent',
      color: active ? '#1a1a2e' : 'var(--text, #e2e8f0)',
      transition: 'background 0.15s',
    }),
    toolLabel: { fontSize: 9, lineHeight: 1 },
    separator: {
      width: '80%', height: 1, background: 'var(--bd, #2d3748)', margin: '6px 0',
    },
    colorRow: {
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3, padding: '0 4px',
    },
    colorSwatch: (c, selected) => ({
      width: 18, height: 18, borderRadius: 4, cursor: 'pointer',
      background: c,
      border: selected ? '2px solid var(--or, #f6ad55)' : '1px solid #4a5568',
      boxSizing: 'border-box',
    }),
    sliderLabel: { fontSize: 10, color: 'var(--text, #e2e8f0)', marginTop: 4, textAlign: 'center' },
    slider: { width: 54, accentColor: 'var(--or, #f6ad55)' },
    mainArea: {
      flex: 1, overflow: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 16, background: 'var(--bg, #1a1a2e)',
      position: 'relative',
    },
    navBar: {
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      background: 'var(--bg2, #16213e)',
      padding: '6px 14px', borderRadius: 8,
      border: '1px solid var(--bd, #2d3748)',
    },
    navBtn: {
      padding: '3px 10px', borderRadius: 5, border: '1px solid var(--bd, #2d3748)',
      cursor: 'pointer', background: 'var(--bg, #1a1a2e)', color: 'var(--text, #e2e8f0)',
      fontSize: 14, fontWeight: 700,
    },
    zoomSelect: {
      padding: '3px 6px', borderRadius: 5, border: '1px solid var(--bd, #2d3748)',
      background: 'var(--bg, #1a1a2e)', color: 'var(--text, #e2e8f0)', fontSize: 12,
    },
    canvasWrapper: {
      boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
      borderRadius: 4, overflow: 'hidden',
      position: 'relative',
    },
    loadingOverlay: {
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(26,26,46,0.75)', zIndex: 10, borderRadius: 4,
      fontSize: 14, color: '#fff',
    },
    modal: {
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    },
    modalBox: {
      background: 'var(--bg2, #16213e)',
      border: '1px solid var(--bd, #2d3748)',
      borderRadius: 10, padding: 24,
      maxWidth: 560, width: '95%',
      color: 'var(--text, #e2e8f0)',
    },
    modalTitle: { fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--or, #f6ad55)' },
    sigCanvas: {
      display: 'block',
      border: '1px solid var(--bd, #2d3748)',
      borderRadius: 6, background: '#fff',
      cursor: 'crosshair',
      touchAction: 'none',
    },
    statusBar: {
      position: 'fixed', bottom: 16, right: 16, zIndex: 3000,
      background: 'var(--or, #f6ad55)', color: '#1a1a2e',
      padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13,
      pointerEvents: 'none',
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={styles.overlay}>
        <div style={{ margin: 'auto', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Erreur de chargement du PDF</div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>{error}</div>
          <button style={styles.actionBtnSecondary} onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>

      {/* ── Top action bar ── */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>{doc.name}</span>

        <button style={styles.actionBtn} onClick={handleSaveCurrentPage} disabled={loading || pageRendering}>
          💾 Sauvegarder cette page
        </button>

        <button style={styles.actionBtnSecondary} onClick={() => setShowPageModal(true)} disabled={loading || pageRendering}>
          📄 Sauvegarder pages...
        </button>

        {onSaveVersion && (
          <button style={styles.actionBtn} onClick={handleSaveGED} disabled={loading || pageRendering || savingGED}>
            {savingGED ? 'Envoi...' : '☁ Nouvelle version GED'}
          </button>
        )}

        <button style={styles.actionBtnDanger} onClick={handleUndoAll} disabled={loading || pageRendering}>
          ↺ Annuler tout
        </button>

        <button style={styles.closeBtn} onClick={() => { saveCurrentPageAnnotations(); persistToStorage(); onClose(); }}>
          ✕ Fermer
        </button>
      </div>

      {/* ── Body ── */}
      <div style={styles.body}>

        {/* ── Left toolbar ── */}
        <div style={styles.sidebar}>
          {TOOLS.map(t => (
            <button
              key={t.id}
              style={styles.toolBtn(tool === t.id)}
              onClick={() => {
                if (t.id === 'signature') { setShowSigModal(true); return; }
                if (t.id === 'group') { handleGroup(); return; }
                if (t.id === 'ungroup') { handleUngroup(); return; }
                setTool(t.id);
              }}
              title={t.label}
            >
              <span>{t.icon}</span>
              <span style={styles.toolLabel}>{t.label}</span>
            </button>
          ))}

          <div style={styles.separator} />

          {/* Color palette */}
          <div style={styles.colorRow}>
            {COLORS.map(c => (
              <div
                key={c.value}
                style={styles.colorSwatch(c.value, color === c.value)}
                title={c.label}
                onClick={() => setColor(c.value)}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              title="Couleur personnalisée"
              style={{ width: 18, height: 18, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
          </div>

          <div style={styles.sliderLabel}>Couleur trait</div>

          <div style={styles.separator} />

          {/* Fill color */}
          <div style={styles.sliderLabel}>Remplissage</div>
          <div style={styles.colorRow}>
            <div
              style={{ ...styles.colorSwatch('transparent', fillColor === 'transparent'), background: 'transparent', backgroundImage: 'repeating-linear-gradient(45deg,#aaa 0,#aaa 2px,transparent 0,transparent 50%)', backgroundSize: '4px 4px' }}
              title="Transparent"
              onClick={() => setFillColor('transparent')}
            />
            {COLORS.map(c => (
              <div
                key={c.value}
                style={styles.colorSwatch(c.value, fillColor === c.value)}
                title={c.label}
                onClick={() => setFillColor(c.value)}
              />
            ))}
            <input
              type="color"
              value={fillColor === 'transparent' ? '#ffffff' : fillColor}
              onChange={e => setFillColor(e.target.value)}
              title="Couleur de remplissage"
              style={{ width: 18, height: 18, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
          </div>

          <div style={styles.separator} />

          {/* Line width */}
          <div style={styles.sliderLabel}>Épaisseur: {lineWidth}px</div>
          <input
            type="range" min={1} max={20} value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            style={styles.slider}
          />

          <div style={styles.separator} />

          {/* Font size */}
          <div style={styles.sliderLabel}>Texte: {fontSize}px</div>
          <input
            type="range" min={8} max={72} value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            style={styles.slider}
          />
        </div>

        {/* ── Main canvas area ── */}
        <div style={styles.mainArea}>

          {/* Nav bar */}
          <div style={styles.navBar}>
            <button style={styles.navBtn} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || loading}>‹</button>
            <span style={{ fontSize: 13 }}>Page {currentPage} / {totalPages}</span>
            <button style={styles.navBtn} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || loading}>›</button>
            <input
              type="number" min={1} max={totalPages}
              value={gotoPage}
              onChange={e => setGotoPage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(gotoPage); if (!isNaN(n)) goToPage(n); } }}
              placeholder="Aller à..."
              style={{ width: 65, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--bd, #2d3748)', background: 'var(--bg, #1a1a2e)', color: 'var(--text, #e2e8f0)', fontSize: 12 }}
            />
            <select
              value={zoom}
              onChange={e => { saveCurrentPageAnnotations(); setZoom(Number(e.target.value)); }}
              style={styles.zoomSelect}
            >
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(z => (
                <option key={z} value={z}>{Math.round(z * 100)}%</option>
              ))}
            </select>
          </div>

          {/* Canvas wrapper */}
          <div style={styles.canvasWrapper}>
            {(loading || pageRendering) && (
              <div style={styles.loadingOverlay}>
                {loading ? 'Chargement du PDF...' : 'Rendu de la page...'}
              </div>
            )}
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {/* ── Signature modal ── */}
      {showSigModal && (
        <div style={styles.modal} onClick={e => { if (e.target === e.currentTarget) setShowSigModal(false); }}>
          <div style={styles.modalBox}>
            <div style={styles.modalTitle}>Signature électronique</div>
            <canvas
              ref={sigCanvasRef}
              width={500} height={200}
              style={styles.sigCanvas}
              onMouseDown={onSigStart}
              onMouseMove={onSigMove}
              onMouseUp={onSigEnd}
              onMouseLeave={onSigEnd}
              onTouchStart={onSigStart}
              onTouchMove={onSigMove}
              onTouchEnd={onSigEnd}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
              <button style={styles.actionBtnSecondary} onClick={() => setShowSigModal(false)}>Annuler</button>
              <button style={styles.actionBtnDanger} onClick={clearSignature}>Effacer</button>
              <button style={styles.actionBtn} onClick={applySignature}>Appliquer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page selector modal ── */}
      {showPageModal && (
        <div style={styles.modal} onClick={e => { if (e.target === e.currentTarget) setShowPageModal(false); }}>
          <div style={{ ...styles.modalBox, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={styles.modalTitle}>Sauvegarder les pages</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button style={styles.actionBtnSecondary} onClick={() => setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1))}>
                Tout sélectionner
              </button>
              <button style={styles.actionBtnSecondary} onClick={() => setSelectedPages([])}>
                Désélectionner
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 14 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pn => (
                <label key={pn} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedPages.includes(pn)}
                    onChange={e => {
                      if (e.target.checked) setSelectedPages(prev => [...prev, pn].sort((a, b) => a - b));
                      else setSelectedPages(prev => prev.filter(p => p !== pn));
                    }}
                    style={{ accentColor: 'var(--or, #f6ad55)' }}
                  />
                  Page {pn}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={styles.actionBtnSecondary} onClick={() => setShowPageModal(false)}>Annuler</button>
              <button style={styles.actionBtn} onClick={handleSavePages} disabled={selectedPages.length === 0}>
                Télécharger les pages sélectionnées ({selectedPages.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status message ── */}
      {statusMsg && <div style={styles.statusBar}>{statusMsg}</div>}
    </div>
  );
}
