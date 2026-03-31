const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Eco-Formalités';
const FROM_EMAIL = SMTP_EMAIL;

// ── Auto-détection SMTP selon le domaine email ─────────────────────────────
const SMTP_PROVIDERS = {
  'gmail.com':          { host: 'smtp.gmail.com',          port: 587 },
  'googlemail.com':     { host: 'smtp.gmail.com',          port: 587 },
  'outlook.com':        { host: 'smtp-mail.outlook.com',   port: 587 },
  'outlook.fr':         { host: 'smtp-mail.outlook.com',   port: 587 },
  'hotmail.com':        { host: 'smtp-mail.outlook.com',   port: 587 },
  'hotmail.fr':         { host: 'smtp-mail.outlook.com',   port: 587 },
  'live.com':           { host: 'smtp-mail.outlook.com',   port: 587 },
  'live.fr':            { host: 'smtp-mail.outlook.com',   port: 587 },
  'yahoo.com':          { host: 'smtp.mail.yahoo.com',     port: 587 },
  'yahoo.fr':           { host: 'smtp.mail.yahoo.com',     port: 587 },
};

function getSmtpConfig(email) {
  const domain = (email || '').split('@')[1]?.toLowerCase();
  if (SMTP_PROVIDERS[domain]) return SMTP_PROVIDERS[domain];
  // Domaine custom (ex: @eco-formalites.com) → Microsoft 365 par défaut
  return { host: SMTP_HOST, port: SMTP_PORT };
}

// Cache des transporteurs par email (évite de recréer à chaque envoi)
const transporterCache = {};

function getTransporter(email, password) {
  const key = email;
  if (transporterCache[key]) return transporterCache[key];
  const config = getSmtpConfig(email);
  const t = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: { user: email, pass: password },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
  });
  transporterCache[key] = t;
  return t;
}

/**
 * Envoie un email via SMTP.
 * Détecte automatiquement le provider (Gmail, Outlook, Microsoft 365).
 * Le mail apparaît dans les "Éléments envoyés" du compte automatiquement.
 * @param {object} opts
 * @param {string} opts.smtp_user   — email SMTP (optionnel, fallback .env)
 * @param {string} opts.smtp_pass   — mot de passe SMTP (optionnel, fallback .env)
 */
async function sendViaSmtp({ smtp_user, smtp_pass, from_email, from_name, to, to_name, subject, html, text, attachments = [] }) {
  const user = smtp_user || FROM_EMAIL;
  const pass = smtp_pass || SMTP_PASSWORD;
  if (!user || !pass) throw new Error('SMTP non configuré — renseigne SMTP_EMAIL et SMTP_PASSWORD dans .env ou le mot de passe SMTP dans ton profil CRM');
  const transporter = getTransporter(user, pass);
  const fromAddr = from_email || user;
  const fromLabel = from_name || FROM_NAME;
  const result = await transporter.sendMail({
    from: `${fromLabel} <${fromAddr}>`,
    to: to_name ? `${to_name} <${to}>` : to,
    subject,
    html,
    text: text || undefined,
    attachments: attachments.map(f => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype })),
  });
  return { id: result.messageId };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Replace {{variable}} placeholders in a string.
 */
function interpolate(str, vars = {}) {
  if (!str) return '';
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? vars[key] : `{{${key}}}`
  );
}

/**
 * Build variables map from a dossier row.
 */
function dossierVars(dossier) {
  if (!dossier) return {};
  return {
    client_name:   dossier.client      || '',
    client_email:  dossier.email       || '',
    client_phone:  dossier.phone       || '',
    client_address:dossier.address     || '',
    dossier_id:    dossier.id          || '',
    dp_number:     dossier.dp_number   || '',
    status:        dossier.status      || '',
    assignee:      dossier.assignee    || '',
    amount:        dossier.amount      || '',
    date_today:    new Date().toLocaleDateString('fr-FR'),
    company_name:  FROM_NAME,
    company_email: FROM_EMAIL,
  };
}

// ── Default templates (seeded on first run) ───────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    name: 'Confirmation de dossier',
    subject: 'Votre dossier {{dossier_id}} — Eco-Formalités',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','dp_number','assignee','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour {{client_name}},</p>
    <p>Votre dossier est bien enregistré. Voici un récapitulatif :</p>
    <table style="width:100%;background:#FEF3EE;border-radius:8px;padding:14px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Référence</td><td style="padding:5px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">N° Demande Préalable</td><td style="padding:5px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Votre conseiller</td><td style="padding:5px 12px;font-weight:700;">{{assignee}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Date</td><td style="padding:5px 12px;">{{date_today}}</td></tr>
    </table>
    <p>On revient vers vous sous 48h pour la suite.</p>
    <p style="margin-top:24px;">Bonne journée,<br><strong>{{assignee}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_name}}</span></p>
  </div>
  <div style="background:#FEF3EE;padding:10px 24px;text-align:center;font-size:11px;color:#A0A090;border-radius:0 0 8px 8px;">
    {{company_name}} — {{company_email}}
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nVotre dossier {{dossier_id}} est bien enregistré (DP: {{dp_number}}).\nVotre conseiller : {{assignee}}\n\nOn revient vers vous sous 48h.\n\n{{assignee}} — {{company_name}}`
  },
  {
    name: 'Demande Préalable — Mairie',
    subject: 'Dépôt déclaration préalable — {{client_name}} — {{dp_number}}',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Dépôt de déclaration préalable</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je vous contacte au nom de <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong>, pour le dépôt d'une déclaration préalable de travaux.</p>
    <p>Vous trouverez le dossier complet en pièce jointe.</p>
    <table style="width:100%;background:#FEF3EE;border-radius:8px;padding:14px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Réf. interne</td><td style="padding:5px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">N° déclaration</td><td style="padding:5px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Date</td><td style="padding:5px 12px;">{{date_today}}</td></tr>
    </table>
    <p>Merci de bien vouloir accuser réception et nous transmettre le numéro d'enregistrement officiel.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nDépôt d'une déclaration préalable pour {{client_name}} ({{client_address}}).\nRéf: {{dossier_id}} — N° déclaration: {{dp_number}} — {{date_today}}\n\nMerci d'accuser réception.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Raccordement Enedis',
    subject: 'Demande raccordement — {{client_name}} — Réf. {{dossier_id}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','client_phone','dossier_id','dp_number','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Raccordement réseau</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je vous transmets une demande de raccordement pour le client suivant :</p>
    <table style="width:100%;background:#FEF3EE;border-radius:8px;padding:14px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Client</td><td style="padding:5px 12px;font-weight:700;">{{client_name}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Adresse travaux</td><td style="padding:5px 12px;font-weight:700;">{{client_address}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Téléphone</td><td style="padding:5px 12px;">{{client_phone}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Réf. dossier</td><td style="padding:5px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">N° DP</td><td style="padding:5px 12px;">{{dp_number}}</td></tr>
    </table>
    <p>Les pièces nécessaires sont jointes. Merci de confirmer la réception et de nous communiquer le numéro de dossier de raccordement.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nDemande de raccordement pour {{client_name}} ({{client_address}}) — Tél: {{client_phone}}\nRéf: {{dossier_id}} — DP: {{dp_number}}\n\nMerci de confirmer la réception.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Consuel — Demande de visa',
    subject: 'Demande Consuel — {{client_name}} — Réf. {{dossier_id}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Demande Consuel</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je vous adresse une demande de visa Consuel pour l'installation de <strong>{{client_name}}</strong>, situé au <strong>{{client_address}}</strong> (réf. <strong>{{dossier_id}}</strong>).</p>
    <p>Le schéma unifilaire et l'attestation de conformité sont joints à ce message.</p>
    <p>Merci de nous retourner le visa dès validation.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nDemande Consuel pour {{client_name}} ({{client_address}}) — Réf: {{dossier_id}} — {{date_today}}\nPièces jointes : schéma unifilaire + attestation conformité.\n\nMerci de nous retourner le visa.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Document manquant',
    subject: 'Dossier {{dossier_id}} — Documents à nous faire parvenir',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','missing_docs','assignee','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Documents requis</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour {{client_name}},</p>
    <p>Pour finaliser votre dossier <strong>{{dossier_id}}</strong>, il nous manque encore :</p>
    <div style="background:#FEF3EE;border-left:3px solid #E8501A;padding:14px 18px;border-radius:0 6px 6px 0;margin:16px 0;">
      {{missing_docs}}
    </div>
    <p>Vous pouvez nous les envoyer en répondant à cet email.</p>
    <p style="margin-top:24px;">Bonne journée,<br><strong>{{assignee}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_name}} — {{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nPour finaliser votre dossier {{dossier_id}}, il nous manque :\n{{missing_docs}}\n\nEnvoyez-les en répondant à cet email.\n\n{{assignee}} — {{company_name}}`
  },
  {
    name: 'Dossier validé',
    subject: 'Dossier {{dossier_id}} validé — Eco-Formalités',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','date_today','assignee']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Dossier validé</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour {{client_name}},</p>
    <p>Votre dossier <strong>{{dossier_id}}</strong> est validé en date du {{date_today}}. Toutes les démarches administratives sont terminées.</p>
    <p>N'hésitez pas à nous contacter si vous avez des questions.</p>
    <p style="margin-top:24px;">Bonne journée,<br><strong>{{assignee}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_name}}</span></p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nVotre dossier {{dossier_id}} est validé ({{date_today}}). Toutes les démarches sont terminées.\n\n{{assignee}} — {{company_name}}`
  },
  {
    name: 'Relance client',
    subject: 'Dossier {{dossier_id}} — En attente de votre retour',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','assignee','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour {{client_name}},</p>
    <p>Je me permets de revenir vers vous concernant votre dossier <strong>{{dossier_id}}</strong>, toujours en attente de votre côté.</p>
    <p>Pouvez-vous me donner signe de vie ? Je reste disponible par retour d'email ou par téléphone.</p>
    <p style="margin-top:24px;">Bonne journée,<br><strong>{{assignee}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_name}} — {{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nJe reviens vers vous pour votre dossier {{dossier_id}}, toujours en attente.\nPouvez-vous me donner signe de vie ?\n\n{{assignee}} — {{company_name}} — {{company_email}}`
  },
  {
    name: 'Relance récépissé de dépôt (J+6)',
    subject: 'DP {{dp_number}} — {{client_name}} — Demande de récépissé',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_envoi_dp','date_today','company_name','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Récépissé de dépôt</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je vous contacte au sujet de la déclaration préalable déposée le <strong>{{date_envoi_dp}}</strong> pour <strong>{{client_name}}</strong> ({{client_address}}).</p>
    <p>À ce jour nous n'avons pas encore reçu de récépissé de dépôt. Pourriez-vous nous le faire parvenir ?</p>
    <table style="width:100%;background:#FEF3EE;border-radius:8px;padding:14px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Réf. interne</td><td style="padding:5px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">N° déclaration</td><td style="padding:5px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Déposé le</td><td style="padding:5px 12px;">{{date_envoi_dp}}</td></tr>
    </table>
    <p>Merci d'avance.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nDP déposée le {{date_envoi_dp}} pour {{client_name}} ({{client_address}}).\nRéf: {{dossier_id}} — N° DP: {{dp_number}}\n\nNous n'avons pas encore reçu le récépissé. Merci de nous le transmettre.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Relance accord Demande Préalable (J+30)',
    subject: 'DP {{dp_number}} — {{client_name}} — Demande de décision',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_envoi_dp','date_today','company_name','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Suivi déclaration préalable</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je fais suite à la déclaration préalable déposée le <strong>{{date_envoi_dp}}</strong> pour <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong>.</p>
    <p>Le délai légal d'instruction d'un mois est désormais dépassé. Pourriez-vous nous indiquer la décision de votre service, ou nous signaler si des pièces complémentaires sont nécessaires ?</p>
    <table style="width:100%;background:#FEF3EE;border-radius:8px;padding:14px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Réf. interne</td><td style="padding:5px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">N° déclaration</td><td style="padding:5px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:5px 12px;color:#6B6B60;font-size:13px;">Déposé le</td><td style="padding:5px 12px;">{{date_envoi_dp}}</td></tr>
    </table>
    <p>Merci d'avance pour votre retour.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nSuite à la DP du {{date_envoi_dp}} pour {{client_name}} ({{client_address}}).\nRéf: {{dossier_id}} — N° DP: {{dp_number}}\n\nLe délai d'un mois est dépassé. Merci de nous communiquer la décision.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Récupération de TVA',
    subject: 'Demande récupération TVA — {{client_name}} — Réf. {{dossier_id}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">Eco-Formalités — Récupération TVA</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Je vous adresse la demande de récupération de TVA pour <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong> (réf. <strong>{{dossier_id}}</strong>, {{date_today}}).</p>
    <p>Les justificatifs sont joints : facture, attestation de travaux et KBIS le cas échéant.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br><span style="color:#6B6B60;font-size:12px;">{{company_email}}</span></p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nDemande récupération TVA pour {{client_name}} ({{client_address}}) — Réf: {{dossier_id}} — {{date_today}}\nPièces jointes : facture, attestation de travaux.\n\n{{company_name}} — {{company_email}}`
  },
];

// ── Seed templates ─────────────────────────────────────────────────────────────

function seedTemplates(db) {
  const now = new Date().toISOString();
  DEFAULT_TEMPLATES.forEach(t => {
    db.get('SELECT id FROM email_templates WHERE name = ?', [t.name], (err, row) => {
      if (err) return;
      if (row) {
        // Mettre à jour le contenu du template existant
        db.run(
          `UPDATE email_templates SET subject=?, category=?, variables=?, body_html=?, body_text=?, updated=? WHERE name=?`,
          [t.subject, t.category, t.variables, t.body_html, t.body_text || '', now, t.name]
        );
      } else {
        db.run(
          `INSERT INTO email_templates (name, subject, category, variables, body_html, body_text, created, updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.name, t.subject, t.category, t.variables, t.body_html, t.body_text || '', now, now]
        );
      }
    });
  });
  console.log(`✅ ${DEFAULT_TEMPLATES.length} templates email synchronisés`);
}

// ── Cron: process scheduled emails every minute ───────────────────────────────

function startEmailCron(db) {
  cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();
    db.all(
      `SELECT * FROM email_queue WHERE status = 'pending' AND scheduled_at <= ?`,
      [now],
      async (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        for (const row of rows) {
          try {
            const senderEmail = row.from_email || FROM_EMAIL;
            const senderName  = row.from_name  || FROM_NAME;
            // Chercher le mot de passe SMTP de l'expéditeur dans la table users
            const senderUser = await new Promise(res => {
              if (!senderEmail) return res(null);
              db.get('SELECT smtp_password FROM users WHERE email = ?', [senderEmail], (_, u) => res(u));
            });
            const result = await sendViaSmtp({
              smtp_user: senderUser?.smtp_password ? senderEmail : undefined,
              smtp_pass: senderUser?.smtp_password || undefined,
              from_email: senderEmail, from_name: senderName,
              to: row.to_email, to_name: row.to_name,
              subject: row.subject, html: row.body_html, text: row.body_text,
            });
            db.run(
              `UPDATE email_queue SET status='sent', sent_at=?, resend_id=? WHERE id=?`,
              [new Date().toISOString(), result.id || null, row.id]
            );
            db.run(
              `INSERT INTO email_log (queue_id, dossier_id, to_email, subject, status, resend_id, sent_at)
               VALUES (?, ?, ?, ?, 'sent', ?, ?)`,
              [row.id, row.dossier_id, row.to_email, row.subject, result.id || null, new Date().toISOString()]
            );
          } catch (sendErr) {
            const errMsg = sendErr.message || 'Unknown error';
            db.run(
              `UPDATE email_queue SET status='error', error=? WHERE id=?`,
              [errMsg, row.id]
            );
            db.run(
              `INSERT INTO email_log (queue_id, dossier_id, to_email, subject, status, error, sent_at)
               VALUES (?, ?, ?, ?, 'error', ?, ?)`,
              [row.id, row.dossier_id, row.to_email, row.subject, errMsg, new Date().toISOString()]
            );
          }
        }
      }
    );
  });
  console.log('⏰ Cron email démarré (vérification chaque minute)');

  // ── Helper : résoudre l'email de l'assignee (expéditeur) ──────────────────
  function resolveAssigneeEmail(dossier) {
    return new Promise(resolve => {
      if (!dossier.assignee) return resolve(null);
      db.get('SELECT email, name, smtp_password FROM users WHERE name = ?', [dossier.assignee], (err, user) => {
        resolve(user || null);
      });
    });
  }

  // ── Helper : résoudre l'email mairie (champ dédié → scan commentaires) ──
  function resolveMairieEmail(dossier) {
    if (dossier.mairie_email) return dossier.mairie_email;
    try {
      const comments = JSON.parse(dossier.comments || '[]');
      const re = /[\w.+%-]+@[\w-]+\.[a-z]{2,}/i;
      for (const c of comments) {
        const m = (c.text || '').match(re);
        if (m) return m[0];
      }
    } catch { /* ignore */ }
    return null;
  }

  // ── Cron quotidien 8h00 : relances automatiques DP ───────────────────────
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON RELANCES] Vérification des relances DP automatiques...');
    const now = new Date().toISOString();

    // ── Relance 1 : J+6 → récépissé de dépôt (vers mairie) ──────────────────
    db.all(
      `SELECT * FROM dossiers
       WHERE date_envoi_dp IS NOT NULL
         AND date_envoi_dp != ''
         AND relance_recepisee_at IS NULL
         AND date(date_envoi_dp) <= date('now', '-6 days')`,
      [],
      async (err, dossiers) => {
        if (err) { console.error('[CRON] Erreur relance J+6:', err.message); return; }
        if (!dossiers || dossiers.length === 0) return;

        db.get(
          `SELECT * FROM email_templates WHERE name = 'Relance récépissé de dépôt (J+6)'`,
          [],
          async (tErr, tmpl) => {
            if (tErr || !tmpl) { console.error('[CRON] Template J+6 introuvable'); return; }
            for (const d of dossiers) {
              const toEmail = resolveMairieEmail(d);
              if (!toEmail) {
                console.log(`[CRON] Relance J+6 ignorée — pas d'email mairie (dossier ${d.id})`);
                continue;
              }
              const assignee = await resolveAssigneeEmail(d);
              const senderEmail = assignee?.email || FROM_EMAIL;
              const senderName  = assignee?.name  || FROM_NAME;
              const vars = {
                ...dossierVars(d),
                company_email: senderEmail,
                company_name:  senderName,
                date_envoi_dp: d.date_envoi_dp
                  ? new Date(d.date_envoi_dp).toLocaleDateString('fr-FR') : '',
              };
              const subject  = interpolate(tmpl.subject,   vars);
              const bodyHtml = interpolate(tmpl.body_html, vars);
              const bodyText = interpolate(tmpl.body_text, vars);
              await new Promise(res => db.run(
                `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created, from_email, from_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                [tmpl.id, d.id, toEmail, 'Service Urbanisme', subject, bodyHtml, bodyText, now, now, senderEmail, senderName],
                res
              ));
              db.run(`UPDATE dossiers SET relance_recepisee_at = ? WHERE id = ?`, [now, d.id]);
              console.log(`[CRON] Relance J+6 enqueued → ${toEmail} from ${senderEmail} (dossier ${d.id})`);
            }
          }
        );
      }
    );

    // ── Relance 2 : J+30 → accord de la DP (vers mairie) ────────────────────
    db.all(
      `SELECT * FROM dossiers
       WHERE date_envoi_dp IS NOT NULL
         AND date_envoi_dp != ''
         AND relance_accord_dp_at IS NULL
         AND date(date_envoi_dp) <= date('now', '-30 days')`,
      [],
      async (err, dossiers) => {
        if (err) { console.error('[CRON] Erreur relance J+30:', err.message); return; }
        if (!dossiers || dossiers.length === 0) return;

        db.get(
          `SELECT * FROM email_templates WHERE name = 'Relance accord Demande Préalable (J+30)'`,
          [],
          async (tErr, tmpl) => {
            if (tErr || !tmpl) { console.error('[CRON] Template J+30 introuvable'); return; }
            for (const d of dossiers) {
              const toEmail = resolveMairieEmail(d);
              if (!toEmail) {
                console.log(`[CRON] Relance J+30 ignorée — pas d'email mairie (dossier ${d.id})`);
                continue;
              }
              const assignee = await resolveAssigneeEmail(d);
              const senderEmail = assignee?.email || FROM_EMAIL;
              const senderName  = assignee?.name  || FROM_NAME;
              const vars = {
                ...dossierVars(d),
                company_email: senderEmail,
                company_name:  senderName,
                date_envoi_dp: d.date_envoi_dp
                  ? new Date(d.date_envoi_dp).toLocaleDateString('fr-FR') : '',
              };
              const subject  = interpolate(tmpl.subject,   vars);
              const bodyHtml = interpolate(tmpl.body_html, vars);
              const bodyText = interpolate(tmpl.body_text, vars);
              await new Promise(res => db.run(
                `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created, from_email, from_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                [tmpl.id, d.id, toEmail, 'Service Urbanisme', subject, bodyHtml, bodyText, now, now, senderEmail, senderName],
                res
              ));
              db.run(`UPDATE dossiers SET relance_accord_dp_at = ? WHERE id = ?`, [now, d.id]);
              console.log(`[CRON] Relance J+30 enqueued → ${toEmail} from ${senderEmail} (dossier ${d.id})`);
            }
          }
        );
      }
    );
  });
  console.log('⏰ Cron relances DP démarré (tous les jours à 08:00)');
}

// ── Routes: Templates ─────────────────────────────────────────────────────────

// GET all templates
router.get('/templates', (req, res) => {
  req.db.all('SELECT * FROM email_templates ORDER BY category, name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const data = rows.map(r => ({ ...r, variables: JSON.parse(r.variables || '[]') }));
    res.json(data);
  });
});

// GET single template
router.get('/templates/:id', (req, res) => {
  req.db.get('SELECT * FROM email_templates WHERE id=?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Template introuvable' });
    res.json({ ...row, variables: JSON.parse(row.variables || '[]') });
  });
});

// POST create template
router.post('/templates', (req, res) => {
  const { name, subject, category = 'general', variables = [], body_html, body_text = '' } = req.body;
  if (!name || !subject || !body_html) return res.status(400).json({ error: 'name, subject et body_html sont requis' });
  const now = new Date().toISOString();
  req.db.run(
    `INSERT INTO email_templates (name, subject, category, variables, body_html, body_text, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, subject, category, JSON.stringify(variables), body_html, body_text, now, now],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Template créé' });
    }
  );
});

// PUT update template
router.put('/templates/:id', (req, res) => {
  const { name, subject, category, variables, body_html, body_text } = req.body;
  const now = new Date().toISOString();
  req.db.run(
    `UPDATE email_templates SET name=?, subject=?, category=?, variables=?, body_html=?, body_text=?, updated=?
     WHERE id=?`,
    [name, subject, category, JSON.stringify(variables || []), body_html, body_text || '', now, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Template mis à jour' });
    }
  );
});

// DELETE template
router.delete('/templates/:id', (req, res) => {
  req.db.run('DELETE FROM email_templates WHERE id=?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Template supprimé' });
  });
});

// ── Routes: Send & Preview ────────────────────────────────────────────────────

// POST /emails/preview — render template with variables (no send)
router.post('/preview', (req, res) => {
  const { template_id, dossier_id, variables: extraVars = {} } = req.body;

  const doPreview = (template, dossier) => {
    const vars = { ...dossierVars(dossier), ...extraVars };
    res.json({
      subject: interpolate(template.subject, vars),
      body_html: interpolate(template.body_html, vars),
      body_text: interpolate(template.body_text || '', vars),
    });
  };

  if (!template_id) return res.status(400).json({ error: 'template_id requis' });

  req.db.get('SELECT * FROM email_templates WHERE id=?', [template_id], (err, template) => {
    if (err || !template) return res.status(404).json({ error: 'Template introuvable' });

    if (dossier_id) {
      req.db.get('SELECT * FROM dossiers WHERE id=?', [dossier_id], (err2, dossier) => {
        doPreview(template, dossier || null);
      });
    } else {
      doPreview(template, null);
    }
  });
});

// POST /emails/send — envoyer immédiatement (supporte les pièces jointes via multipart/form-data)
router.post('/send', upload.array('attachments'), async (req, res) => {
  const body = req.body;
  const to          = body.to;
  const to_name     = body.to_name;
  const subject     = body.subject;
  const body_html   = body.body_html;
  const body_text   = body.body_text;
  const template_id = body.template_id;
  const dossier_id  = body.dossier_id;
  const extraVars   = body.variables ? (typeof body.variables === 'string' ? JSON.parse(body.variables) : body.variables) : {};
  const reqFromEmail = body.from_email;
  const reqFromName  = body.from_name;
  const files = req.files || [];

  if (!to) return res.status(400).json({ error: 'Destinataire (to) requis' });

  const senderEmail = reqFromEmail || FROM_EMAIL;
  const senderName  = reqFromName  || FROM_NAME;

  // Chercher le mot de passe SMTP de l'expéditeur
  const senderUser = await new Promise(resolve => {
    if (!senderEmail) return resolve(null);
    req.db.get('SELECT smtp_password FROM users WHERE email = ?', [senderEmail], (_, u) => resolve(u));
  });

  const doSend = async (finalSubject, finalHtml, finalText) => {
    try {
      const result = await sendViaSmtp({
        smtp_user: senderUser?.smtp_password ? senderEmail : undefined,
        smtp_pass: senderUser?.smtp_password || undefined,
        from_email: senderEmail, from_name: senderName,
        to, to_name, subject: finalSubject, html: finalHtml, text: finalText, attachments: files,
      });

      const now = new Date().toISOString();
      req.db.run(
        `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, sent_at, status, resend_id, created, from_email, from_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)`,
        [template_id || null, dossier_id || null, to, to_name || null, finalSubject, finalHtml, finalText || '', now, now, result.id || null, now, senderEmail, senderName]
      );
      req.db.run(
        `INSERT INTO email_log (dossier_id, to_email, subject, status, resend_id, sent_at)
         VALUES (?, ?, ?, 'sent', ?, ?)`,
        [dossier_id || null, to, finalSubject, result.id || null, now]
      );

      res.json({ success: true, id: result.id, message: 'Email envoyé' });
    } catch (err) {
      const errMsg = err.message || 'Erreur envoi email';
      req.db.run(
        `INSERT INTO email_log (dossier_id, to_email, subject, status, error, sent_at)
         VALUES (?, ?, ?, 'error', ?, ?)`,
        [dossier_id || null, to, subject || '(no subject)', errMsg, new Date().toISOString()]
      );
      res.status(500).json({ error: errMsg });
    }
  };

  // If using a template, interpolate it first
  if (template_id) {
    req.db.get('SELECT * FROM email_templates WHERE id=?', [template_id], (err, template) => {
      if (err || !template) return res.status(404).json({ error: 'Template introuvable' });

      const doWithDossier = (dossier) => {
        const vars = { ...dossierVars(dossier), ...extraVars };
        doSend(
          interpolate(template.subject, vars),
          interpolate(template.body_html, vars),
          interpolate(template.body_text || '', vars)
        );
      };

      if (dossier_id) {
        req.db.get('SELECT * FROM dossiers WHERE id=?', [dossier_id], (err2, dossier) => {
          doWithDossier(dossier || null);
        });
      } else {
        doWithDossier(null);
      }
    });
  } else {
    if (!subject || !body_html) return res.status(400).json({ error: 'subject et body_html requis sans template' });
    doSend(subject, body_html, body_text);
  }
});

// POST /emails/schedule — programmer un email
router.post('/schedule', (req, res) => {
  const {
    to, to_name, subject, body_html, body_text,
    template_id, dossier_id, scheduled_at, variables: extraVars = {},
    from_email: reqFromEmail, from_name: reqFromName
  } = req.body;

  if (!to || !scheduled_at) return res.status(400).json({ error: 'to et scheduled_at requis' });

  const senderEmail = reqFromEmail || FROM_EMAIL;
  const senderName  = reqFromName  || FROM_NAME;

  const doSchedule = (finalSubject, finalHtml, finalText) => {
    const now = new Date().toISOString();
    req.db.run(
      `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created, from_email, from_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [template_id || null, dossier_id || null, to, to_name || null, finalSubject, finalHtml, finalText || '', scheduled_at, now, senderEmail, senderName],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Email programmé', scheduled_at });
      }
    );
  };

  if (template_id) {
    req.db.get('SELECT * FROM email_templates WHERE id=?', [template_id], (err, template) => {
      if (err || !template) return res.status(404).json({ error: 'Template introuvable' });

      const doWithDossier = (dossier) => {
        const vars = { ...dossierVars(dossier), ...extraVars };
        doSchedule(
          interpolate(template.subject, vars),
          interpolate(template.body_html, vars),
          interpolate(template.body_text || '', vars)
        );
      };

      if (dossier_id) {
        req.db.get('SELECT * FROM dossiers WHERE id=?', [dossier_id], (_, dossier) => doWithDossier(dossier || null));
      } else {
        doWithDossier(null);
      }
    });
  } else {
    if (!subject || !body_html) return res.status(400).json({ error: 'subject et body_html requis sans template' });
    doSchedule(subject, body_html, body_text);
  }
});

// ── Routes: Queue ─────────────────────────────────────────────────────────────

// GET queue (pending + recent)
router.get('/queue', (req, res) => {
  const { status, dossier_id } = req.query;
  let query = 'SELECT * FROM email_queue';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (dossier_id) { conditions.push('dossier_id = ?'); params.push(dossier_id); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created DESC LIMIT 200';

  req.db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PATCH update a pending queued email
router.patch('/queue/:id', (req, res) => {
  const { to, to_name, subject, body_html, body_text, scheduled_at } = req.body;
  req.db.run(
    `UPDATE email_queue SET to_email=COALESCE(?,to_email), to_name=COALESCE(?,to_name), subject=COALESCE(?,subject), body_html=COALESCE(?,body_html), body_text=COALESCE(?,body_text), scheduled_at=COALESCE(?,scheduled_at) WHERE id=? AND status='pending'`,
    [to||null, to_name||null, subject||null, body_html||null, body_text||null, scheduled_at||null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: 'Email non trouvé ou déjà envoyé' });
      res.json({ message: 'Email mis à jour' });
    }
  );
});

// DELETE cancel a queued email
router.delete('/queue/:id', (req, res) => {
  req.db.run(
    `UPDATE email_queue SET status='cancelled' WHERE id=? AND status='pending'`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(400).json({ error: 'Email non trouvé ou déjà envoyé' });
      res.json({ message: 'Email annulé' });
    }
  );
});

// ── Routes: Log ───────────────────────────────────────────────────────────────

// GET log
router.get('/log', (req, res) => {
  const { dossier_id } = req.query;
  const query = dossier_id
    ? 'SELECT * FROM email_log WHERE dossier_id=? ORDER BY sent_at DESC LIMIT 200'
    : 'SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 200';
  const params = dossier_id ? [dossier_id] : [];

  req.db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = { router, seedTemplates, startEmailCron };
