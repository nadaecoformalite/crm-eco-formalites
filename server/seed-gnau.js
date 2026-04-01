/**
 * seed-gnau.js — Peuplement du cache GNAU pour tous les EPCIs de France
 *
 * Stratégie (sans Google par défaut) :
 *   1. Récupère la liste des ~1250 EPCIs depuis l'API Géo (gratuit)
 *   2. Pour chaque EPCI :
 *      a. Vérifie le cache SQLite (skip si déjà trouvé)
 *      b. Test URL Operis directe (slug collé)
 *      c. Scan de toutes les URLs candidates (patterns connus)
 *      d. Google fallback (si --google activé et quota dispo)
 *   3. Sauvegarde les résultats dans gnau_cache
 *
 * Usage :
 *   node seed-gnau.js                     # Sans Google (gratuit)
 *   node seed-gnau.js --google            # Avec Google fallback
 *   node seed-gnau.js --google --limit 50 # Tester sur 50 EPCIs
 *   node seed-gnau.js --skip-existing     # Sauter les EPCIs déjà en cache (même not_found)
 *   node seed-gnau.js --resume            # Reprendre après interruption (défaut: saute les found)
 */

'use strict';

require('dotenv').config();
const path   = require('path');
const sqlite3 = require('sqlite3').verbose();

// ── Arguments CLI ────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const USE_GOOGLE   = args.includes('--google');
const SKIP_EXISTING = args.includes('--skip-existing'); // skip même les not_found
const RESUME       = args.includes('--resume') || !SKIP_EXISTING; // par défaut, saute les found
const limitArg     = args.indexOf('--limit');
const MAX_EPCI     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;

// ── Config ───────────────────────────────────────────────────────────────────
const DB_PATH         = path.join(__dirname, 'crm.db');
const GNAU_TIMEOUT    = 5000;
const GNAU_CONCURRENCY = 30;   // URLs testées en parallèle
const EPCI_CONCURRENCY = 3;    // EPCIs traités en parallèle (prudence réseau)
const DELAY_BETWEEN_EPCI = 200; // ms entre chaque EPCI (évite le ban IP)

// ── Base de données ──────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) { console.error('❌ Impossible d\'ouvrir crm.db :', err.message); process.exit(1); }
});

db.run(`CREATE TABLE IF NOT EXISTS gnau_cache (
  epci_code    TEXT PRIMARY KEY,
  epci_nom     TEXT,
  urls         TEXT,
  platform_type TEXT,
  source       TEXT,
  updated      TEXT
)`);

// ════════════════════════════════════════════════════════════════════════════
// Fonctions utilitaires (copiées depuis server.js)
// ════════════════════════════════════════════════════════════════════════════

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function gnauSlug(epciName) {
  let name = epciName;
  const prefixes = [
    /^communaut[eé]\s+de\s+communes\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+d['']?agglom[eé]ration\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+urbaine\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^m[eé]tropole\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cc\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^ca\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cu\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
  ];
  for (const p of prefixes) {
    const stripped = name.replace(p, '').trim();
    if (stripped && stripped !== name) { name = stripped; break; }
  }
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function epciShortNames(fullName) {
  const names = new Set([fullName]);
  const prefixes = [
    /^communaut[eé]\s+de\s+communes\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+d['']?agglom[eé]ration\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^communaut[eé]\s+urbaine\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^m[eé]tropole\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cc\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^ca\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
    /^cu\s+(de\s+la\s+|du\s+|des\s+|de\s+l['']?|d['']?|de\s+)?/i,
  ];
  for (const p of prefixes) {
    const stripped = fullName.replace(p, '').trim();
    if (stripped && stripped !== fullName) names.add(stripped);
  }
  return [...names];
}

function epciSlugVariants(fullName) {
  const slugs = new Set();
  for (const name of epciShortNames(fullName)) {
    const s = slugify(name);
    slugs.add(s);
    slugs.add('cc-' + s);
    slugs.add('ca-' + s);
    slugs.add('cu-' + s);
    slugs.add('cdc-' + s);
    slugs.add('agglo-' + s);
  }
  slugs.add(slugify(fullName));
  slugs.add(gnauSlug(fullName));
  return [...slugs];
}

function identifyPlatformType(url) {
  const s = url.toLowerCase();
  if (s.includes('operis'))      return 'Operis/GNAU';
  if (s.includes('geosphere'))   return 'Geosphere';
  if (s.includes('cartads'))     return 'Cartads';
  if (s.includes('sirap'))       return 'SIRAP';
  if (s.includes('geopermis'))   return 'Geopermis';
  if (s.includes('e-permis'))    return 'e-Permis';
  if (s.includes('atip'))        return 'ATIP';
  if (s.includes('oci-urbanisme')) return 'OCI Urbanisme';
  if (s.includes('xdemat') || s.includes('xurba')) return 'Xdemat/Xurba';
  if (s.includes('ideau') || s.includes("ide'au")) return "iDE'AU";
  if (s.includes('ads.') || s.includes('/ads')) return 'ADS';
  if (s.includes('gnau'))        return 'GNAU';
  if (s.includes('guichet-unique') || s.includes('guichet unique')) return 'Guichet Unique';
  if (s.includes('urbanisme'))   return 'Portail urbanisme';
  return 'Plateforme urbanisme';
}

// ── Patterns et mots-clés (identiques à server.js) ──────────────────────────

const KEYWORDS_HTML = [
  'gnau','guichet numerique des autorisations d urbanisme',
  "guichet numérique des autorisations d'urbanisme",
  'operis','geosphere','geopermis','e-permis','sve sirap',"ide'au",'ideau',
  "autorisation d urbanisme","autorisation d'urbanisme",
  'guichet unique','deposer un dossier','déposer un dossier',
  'permis de construire en ligne','demande d autorisation',
  'communaute de communes','communauté de communes',
  "communaute d agglomeration","communauté d'agglomération",
  'metropole','métropole','service urbanisme','openads','next ads',
  'demarches en ligne urbanisme','teleprocedure urbanisme','cart@ds','cartads',
  'téléprocédure urbanisme','ingenieriere70','sirap','atip67','oci-urbanisme',
  'xdemat','xurba','ads','ideau','rxu','aruci','adau',
  'depot en ligne','dépôt en ligne','teleservice urbanisme','téléservice urbanisme',
  'declaration prealable','déclaration préalable','permis de construire',
  'demande prealable','demande préalable',
];

const GNAU_PATTERNS = [
  'https://gnau{n}.operis.fr/{slug}/gnau/#/',
  'https://gnau{n}.operis.fr/{slug}/gnau/',
  'https://{slug}.geosphere.fr/guichet-unique',
  'https://{slug}.geosphere.fr/gnau',
  'https://cartads.{slug}.fr/guichet-unique',
  'https://cartads.{slug}.fr/gnau',
  'https://gnau.cartads.fr/{slug}',
  'https://{slug}.cartads.fr/',
  'https://portail-usager.sirap.fr/{slug}',
  'https://portail-usager.sirap.com/{slug}',
  'https://sve.sirap.fr/{slug}',
  'https://www.geopermis.fr/{slug}',
  'https://www.e-permis.fr/{slug}',
  'https://appli.atip67.fr/guichet-unique',
  'https://appli.atip67.fr/guichet-unique/Accueil',
  'https://saasweb.oci-urbanisme.fr/{slug}',
  'https://www.spl-xdemat.fr/Xurba/gnau/',
  'https://{slug}.xurba.fr/',
  'https://xurba.{slug}.fr/',
  'https://{slug}.ideau.fr/',
  'https://ideau.{slug}.fr/',
  'https://{slug}.ads.{slug}.fr/gnau/#/',
  'https://ads.{slug}.fr/gnau/#/',
  'https://{slug}.ads.fr/gnau/#/',
  'https://urbanisme.{slug}.fr/gnaud/',
  'https://urbanisme.{slug}.fr/',
  'https://gnau.{slug}.fr/',
  'https://{slug}.fr/gnau/',
  'https://www.{slug}.fr/gnau/',
  'https://{slug}.fr/guichet-unique',
  'https://www.{slug}.fr/guichet-unique',
  'https://{slug}.fr/urbanisme',
  'https://www.{slug}.fr/urbanisme',
  'https://{slug}.fr/urbanisme/gnau',
  'https://www.{slug}.fr/urbanisme/gnau',
  'https://{slug}.fr/demarches',
  'https://www.{slug}.fr/demarches',
  'https://urbanisme.{slug}.fr/gnau/',
  'https://urbanisme.{slug}.fr/gnau/#/',
  'https://gnau.{slug}.fr/gnau/#/',
  'https://sve.{slug}.fr/',
  'https://autorisations-urbanisme.{slug}.fr/',
  'https://ads.{slug}.fr/',
  'https://guichet-unique.{slug}.fr/',
];

const EXTRA_PATHS = [
  'gnau','gnau/#/','guichet-unique','guichet-unique/Accueil',
  'urbanisme','ads','ads/gnau','urbanisme/gnau','demarches/urbanisme',
];

// ════════════════════════════════════════════════════════════════════════════
// Logique de recherche
// ════════════════════════════════════════════════════════════════════════════

function isGnauHtml(html) {
  const norm = normalizeText(html);
  let score = 0;
  for (const kw of KEYWORDS_HTML) {
    if (norm.includes(normalizeText(kw))) score++;
  }
  return score >= 2;
}

function generateEpciUrls(epciName) {
  const slugs = epciSlugVariants(epciName);
  const urls = new Set();
  for (const slug of slugs) {
    for (const p of GNAU_PATTERNS) {
      if (p.includes('{n}')) {
        for (let n = 1; n <= 49; n++) {
          urls.add(p.replace(/\{n\}/g, n).replace(/\{slug\}/g, slug));
        }
      } else {
        urls.add(p.replace(/\{slug\}/g, slug));
      }
    }
    for (const domain of [`${slug}.fr`, `www.${slug}.fr`]) {
      for (const p of EXTRA_PATHS) {
        urls.add(`https://${domain}/${p}`);
        urls.add(`https://${domain}/${p}/`);
      }
    }
  }
  return [...urls];
}

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GNAU_TIMEOUT);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 EcoFormalitesCRM/2.0' },
    });
    clearTimeout(timer);
    if (resp.status >= 200 && resp.status < 400) {
      const html = await resp.text();
      if (isGnauHtml(html)) return { url, finalUrl: resp.url };
    }
  } catch { /* timeout ou DNS fail — normal */ }
  return null;
}

async function scanAllUrls(urls) {
  const results = [];
  for (let i = 0; i < urls.length; i += GNAU_CONCURRENCY) {
    const batch = urls.slice(i, i + GNAU_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(u => checkUrl(u)));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        const finalUrl = r.value.finalUrl || r.value.url;
        if (!results.includes(finalUrl)) results.push(finalUrl);
      }
    }
    if (results.length >= 3) break;
  }
  return results;
}

async function googleSearchGnau(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx     = process.env.GOOGLE_CX;
  if (!apiKey || !cx || apiKey === 'votre_cle_google_api') return [];

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=10&lr=lang_fr&gl=fr`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return [];
    const data = await resp.json();

    const candidates = [];
    for (const item of (data.items || [])) {
      const link = item.link || '';
      if (/gnau|operis|geosphere|cartads|sirap|geopermis|e-permis|xurba|xdemat|ideau|oci-urbanisme|guichet-unique|urbanisme|openads|next-ads|sve\.|adau|aruci/i.test(link)) {
        candidates.push(link);
      }
    }
    if (!candidates.length) return [];

    // Vérifier que la première URL est vivante et contient du contenu GNAU
    const checked = await checkUrl(candidates[0]);
    if (checked) return [checked.finalUrl || candidates[0]];

    return [];
  } catch {
    return [];
  }
}

// ── Recherche pour un EPCI ────────────────────────────────────────────────────

async function processEpci(epciCode, epciNom) {
  // Étape 0 : URL Operis directe (slug collé, n=1)
  const operisUrl = `https://gnau1.operis.fr/${gnauSlug(epciNom)}/gnau/#/`;
  const operisHit = await checkUrl(operisUrl);
  if (operisHit) {
    const finalUrl = operisHit.finalUrl || operisUrl;
    saveCached(epciCode, epciNom, [finalUrl], 'scan_operis_direct');
    return { found: true, source: 'scan_operis_direct', url: finalUrl };
  }

  // Étape 1 : Scan de toutes les URLs candidates
  const allUrls   = generateEpciUrls(epciNom);
  const scanHits  = await scanAllUrls(allUrls);
  if (scanHits.length) {
    saveCached(epciCode, epciNom, scanHits, 'scan_epci');
    return { found: true, source: 'scan_epci', url: scanHits[0] };
  }

  // Étape 2 : Google fallback (si activé)
  if (USE_GOOGLE) {
    const q1 = `gnau "${epciNom}"`;
    const g1  = await googleSearchGnau(q1);
    if (g1.length) {
      saveCached(epciCode, epciNom, g1, 'google_epci');
      return { found: true, source: 'google_epci', url: g1[0] };
    }

    const slug = gnauSlug(epciNom);
    const q2   = `gnau "${slug}" urbanisme`;
    const g2   = await googleSearchGnau(q2);
    if (g2.length) {
      saveCached(epciCode, epciNom, g2, 'google_slug');
      return { found: true, source: 'google_slug', url: g2[0] };
    }
  }

  // Rien trouvé → enregistrer quand même pour ne pas retenter
  saveCached(epciCode, epciNom, [], 'not_found');
  return { found: false };
}

function saveCached(epciCode, epciNom, urls, source) {
  const platformType = urls.length ? identifyPlatformType(urls[0]) : null;
  db.run(
    'INSERT OR REPLACE INTO gnau_cache (epci_code, epci_nom, urls, platform_type, source, updated) VALUES (?,?,?,?,?,?)',
    [epciCode, epciNom, JSON.stringify(urls), platformType, source, new Date().toISOString()]
  );
}

// ── Lecture du cache existant ─────────────────────────────────────────────────

function getExistingCache() {
  return new Promise((resolve, reject) => {
    db.all('SELECT epci_code, source, urls FROM gnau_cache', (err, rows) => {
      if (err) return reject(err);
      const map = new Map();
      for (const r of rows) map.set(r.epci_code, { source: r.source, hasUrls: r.urls && r.urls !== '[]' });
      resolve(map);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Boucle principale
// ════════════════════════════════════════════════════════════════════════════

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runInBatches(items, batchSize, handler) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(handler));
    await sleep(DELAY_BETWEEN_EPCI);
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Seed GNAU — Eco-Formalités');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Google fallback : ${USE_GOOGLE ? '✅ activé' : '❌ désactivé'}`);
  console.log(`  Skip existants  : ${SKIP_EXISTING ? 'tous' : 'seulement les found'}`);
  if (MAX_EPCI !== Infinity) console.log(`  Limite          : ${MAX_EPCI} EPCIs`);
  console.log('');

  // 1. Récupérer tous les EPCIs
  console.log('📡 Récupération des EPCIs depuis geo.api.gouv.fr...');
  let allEpcis = [];
  try {
    const resp = await fetch('https://geo.api.gouv.fr/epcis?fields=code,nom&limit=2000', {
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    allEpcis = await resp.json();
    console.log(`   ✅ ${allEpcis.length} EPCIs récupérés\n`);
  } catch (err) {
    console.error('❌ Impossible de récupérer les EPCIs :', err.message);
    process.exit(1);
  }

  // 2. Lire le cache existant
  const cache = await getExistingCache();
  console.log(`📦 Cache actuel : ${cache.size} EPCIs déjà en base\n`);

  // 3. Filtrer les EPCIs à traiter
  let toProcess = allEpcis.filter(e => {
    const cached = cache.get(e.code);
    if (!cached) return true;                            // jamais cherché
    if (SKIP_EXISTING) return false;                     // --skip-existing : tout ignorer
    return !cached.hasUrls && cached.source !== 'not_found'; // défaut : retry les not_found récents seulement si non marqués
  });

  // Appliquer la limite
  if (MAX_EPCI !== Infinity) toProcess = toProcess.slice(0, MAX_EPCI);

  const skipped = allEpcis.length - toProcess.length;
  console.log(`🗂  À traiter : ${toProcess.length} EPCIs (${skipped} déjà en cache)\n`);

  if (!toProcess.length) {
    console.log('✅ Rien à faire — tous les EPCIs sont déjà en cache.');
    db.close();
    return;
  }

  // 4. Traitement par lots
  let done = 0, found = 0, notFound = 0;
  const startTime = Date.now();

  const handler = async (epci) => {
    const result = await processEpci(epci.code, epci.nom);
    done++;
    if (result.found) { found++; } else { notFound++; }

    const pct      = ((done / toProcess.length) * 100).toFixed(1);
    const elapsed  = ((Date.now() - startTime) / 1000).toFixed(0);
    const etaSec   = done > 0 ? Math.round((Date.now() - startTime) / done * (toProcess.length - done) / 1000) : 0;
    const etaMin   = Math.floor(etaSec / 60);
    const etaS     = etaSec % 60;
    const status   = result.found ? `✅ ${result.source}` : '—';
    console.log(`[${done}/${toProcess.length}] ${pct}% | ${epci.nom.slice(0, 45).padEnd(45)} | ${status} | ETA ${etaMin}m${etaS}s`);
  };

  await runInBatches(toProcess, EPCI_CONCURRENCY, handler);

  // 5. Résumé final
  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  Résumé final');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Traités       : ${done}`);
  console.log(`  Trouvés       : ${found} (${((found / done) * 100).toFixed(1)}%)`);
  console.log(`  Non trouvés   : ${notFound}`);
  console.log(`  Durée totale  : ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log('');

  // Stats par type de plateforme
  await new Promise(resolve => {
    db.all(
      "SELECT platform_type, COUNT(*) as n FROM gnau_cache WHERE platform_type IS NOT NULL GROUP BY platform_type ORDER BY n DESC",
      (err, rows) => {
        if (!err && rows.length) {
          console.log('  Types de plateformes en cache :');
          rows.forEach(r => console.log(`    ${(r.platform_type || '?').padEnd(20)} : ${r.n}`));
        }
        resolve();
      }
    );
  });

  console.log('════════════════════════════════════════════════════════');
  db.close();
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err);
  db.close();
  process.exit(1);
});
