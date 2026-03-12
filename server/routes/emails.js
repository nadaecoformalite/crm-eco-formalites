const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const cron = require('node-cron');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@eco-formalites.fr';
const FROM_NAME = process.env.FROM_NAME || 'Eco-Formalités';

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
    subject: 'Confirmation de votre dossier {{dossier_id}} — Eco-Formalités',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','dp_number','assignee','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Eco-Formalités</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour <strong>{{client_name}}</strong>,</p>
    <p>Nous avons bien reçu votre dossier et nous vous confirmons son enregistrement dans notre système.</p>
    <table style="width:100%;background:#F5F5F0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Référence dossier</td><td style="padding:6px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">N° Demande Préalable</td><td style="padding:6px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Chargé de dossier</td><td style="padding:6px 12px;font-weight:700;">{{assignee}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Date</td><td style="padding:6px 12px;">{{date_today}}</td></tr>
    </table>
    <p>Votre chargé de dossier prendra contact avec vous sous 48h pour vous informer des prochaines étapes.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>L'équipe {{company_name}}</strong></p>
  </div>
  <div style="background:#F5F5F0;padding:12px 24px;text-align:center;font-size:11px;color:#A0A090;border-radius:0 0 8px 8px;">
    {{company_name}} — {{company_email}}
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nNous confirmons l'enregistrement de votre dossier {{dossier_id}} (DP: {{dp_number}}).\nVotre chargé de dossier : {{assignee}}\n\nCordialement,\n{{company_name}}`
  },
  {
    name: 'Demande Préalable — Mairie',
    subject: 'Demande Préalable de Travaux — {{client_name}} — Parcelle {{dp_number}}',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#1A4A8A;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Demande Préalable</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous représentons <strong>{{client_name}}</strong>, propriétaire situé au <strong>{{client_address}}</strong>, pour le dépôt d'une demande préalable de travaux.</p>
    <p>Vous trouverez ci-joint le dossier complet de demande préalable réf. <strong>{{dp_number}}</strong>.</p>
    <p>Nous vous serions reconnaissants de bien vouloir accuser réception du présent courrier et de nous communiquer le numéro d'enregistrement officiel.</p>
    <table style="width:100%;background:#F5F5F0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Référence interne</td><td style="padding:6px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Demande Préalable n°</td><td style="padding:6px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Date de dépôt</td><td style="padding:6px 12px;">{{date_today}}</td></tr>
    </table>
    <p>Dans l'attente de votre retour, nous restons à votre disposition pour tout renseignement complémentaire.</p>
    <p style="margin-top:24px;">Veuillez agréer l'expression de nos salutations distinguées,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nNous représentons {{client_name}} ({{client_address}}) pour le dépôt d'une demande préalable réf. {{dp_number}}.\n\nMerci d'accuser réception.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Raccordement Enedis',
    subject: 'Demande de raccordement — Dossier {{dossier_id}} — {{client_name}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','client_phone','dossier_id','dp_number','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#059669;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Demande de Raccordement</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous prenons contact avec vous pour la demande de raccordement au réseau pour notre client :</p>
    <table style="width:100%;background:#F5F5F0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Client</td><td style="padding:6px 12px;font-weight:700;">{{client_name}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Adresse des travaux</td><td style="padding:6px 12px;font-weight:700;">{{client_address}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Téléphone</td><td style="padding:6px 12px;">{{client_phone}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Référence dossier</td><td style="padding:6px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">DP n°</td><td style="padding:6px 12px;">{{dp_number}}</td></tr>
    </table>
    <p>Vous trouverez en pièces jointes les documents nécessaires au traitement de cette demande. Merci de nous confirmer la réception et de nous communiquer le numéro de dossier de raccordement.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Demande de raccordement — {{client_name}} ({{client_address}}) — Réf: {{dossier_id}}\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'CONSUEL — Demande de visa',
    subject: 'Demande de CONSUEL — {{client_name}} — Dossier {{dossier_id}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#6B35C8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Demande CONSUEL</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous vous adressons la présente demande de visa CONSUEL pour l'installation de notre client <strong>{{client_name}}</strong> situé au <strong>{{client_address}}</strong>.</p>
    <p>Référence dossier : <strong>{{dossier_id}}</strong><br>Date : <strong>{{date_today}}</strong></p>
    <p>Vous trouverez en pièce jointe le schéma unifilaire et l'attestation de conformité de l'installation.</p>
    <p>Merci de nous faire parvenir le visa CONSUEL dès validation.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Demande CONSUEL — {{client_name}} ({{client_address}}) — Réf: {{dossier_id}} — {{date_today}}\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Document manquant',
    subject: 'Dossier {{dossier_id}} — Document(s) manquant(s)',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','missing_docs','assignee','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#d97706;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Document(s) requis</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour <strong>{{client_name}}</strong>,</p>
    <p>Afin de finaliser le traitement de votre dossier <strong>{{dossier_id}}</strong>, il nous manque les documents suivants :</p>
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0;">
      {{missing_docs}}
    </div>
    <p>Merci de nous les faire parvenir dans les meilleurs délais en répondant directement à cet email ou en les déposant sur votre espace client.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{assignee}}</strong><br>{{company_name}}<br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nDocuments manquants pour le dossier {{dossier_id}} :\n{{missing_docs}}\n\nMerci de nous les faire parvenir.\n\n{{assignee}} — {{company_name}}`
  },
  {
    name: 'Dossier validé',
    subject: '✅ Votre dossier {{dossier_id}} est validé !',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','date_today','assignee']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#059669;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">✅ Dossier Validé</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour <strong>{{client_name}}</strong>,</p>
    <p>Nous avons le plaisir de vous informer que votre dossier <strong>{{dossier_id}}</strong> a été <strong style="color:#059669;">validé</strong> en date du <strong>{{date_today}}</strong>.</p>
    <div style="background:#ecfdf5;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
      <p style="color:#059669;font-size:16px;font-weight:700;margin:0;">🎉 Toutes les démarches administratives sont complètes !</p>
    </div>
    <p>Merci de votre confiance. N'hésitez pas à nous contacter pour toute question.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{assignee}}</strong><br>{{company_name}}</p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nVotre dossier {{dossier_id}} a été validé le {{date_today}}.\n\n{{assignee}} — {{company_name}}`
  },
  {
    name: 'Relance client',
    subject: 'Rappel — Dossier {{dossier_id}} en attente',
    category: 'client',
    variables: JSON.stringify(['client_name','dossier_id','assignee','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#E8501A;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Eco-Formalités — Rappel</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Bonjour <strong>{{client_name}}</strong>,</p>
    <p>Nous revenons vers vous concernant votre dossier <strong>{{dossier_id}}</strong> qui est actuellement en attente de votre action.</p>
    <p>Merci de bien vouloir nous contacter ou de répondre à cet email afin que nous puissions faire avancer votre dossier dans les meilleurs délais.</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{assignee}}</strong><br>{{company_name}}<br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Bonjour {{client_name}},\n\nRappel concernant votre dossier {{dossier_id}} en attente.\n\n{{assignee}} — {{company_name}} — {{company_email}}`
  },
  {
    name: 'Relance récépissé de dépôt (J+6)',
    subject: 'Demande Préalable {{dp_number}} — {{client_name}} — Accusé de réception',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_envoi_dp','date_today','company_name','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#1A4A8A;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Relance récépissé de dépôt</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous revenons vers vous concernant la demande préalable de travaux déposée pour notre client <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong>.</p>
    <p>Notre dossier a été transmis à votre service le <strong>{{date_envoi_dp}}</strong> et nous n'avons pas encore reçu de récépissé de dépôt.</p>
    <table style="width:100%;background:#F5F5F0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Référence interne</td><td style="padding:6px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">N° Demande Préalable</td><td style="padding:6px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Date d'envoi du dossier</td><td style="padding:6px 12px;">{{date_envoi_dp}}</td></tr>
    </table>
    <p>Pourriez-vous, s'il vous plaît, nous confirmer la bonne réception de ce dossier et nous faire parvenir le <strong>récépissé de dépôt</strong> dans les meilleurs délais ?</p>
    <p>Nous restons à votre disposition pour tout renseignement complémentaire.</p>
    <p style="margin-top:24px;">Veuillez agréer l'expression de nos salutations distinguées,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
  <div style="background:#F5F5F0;padding:12px 24px;text-align:center;font-size:11px;color:#A0A090;border-radius:0 0 8px 8px;">
    Relance automatique — {{date_today}} — {{company_name}}
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nRelance concernant la DP de {{client_name}} ({{client_address}}) déposée le {{date_envoi_dp}}.\nRéf: {{dossier_id}} — DP n°: {{dp_number}}\n\nMerci de nous faire parvenir le récépissé de dépôt.\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Relance accord Demande Préalable (J+30)',
    subject: 'Demande Préalable {{dp_number}} — {{client_name}} — Demande de décision',
    category: 'mairie',
    variables: JSON.stringify(['client_name','client_address','dp_number','dossier_id','date_envoi_dp','date_today','company_name','company_email']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#6366f1;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Suivi Demande Préalable</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous nous permettons de revenir vers vous au sujet de la demande préalable de travaux déposée le <strong>{{date_envoi_dp}}</strong> pour notre client <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong>.</p>
    <div style="background:#eef2ff;border-left:4px solid #6366f1;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;font-size:13px;">Le délai légal d'instruction d'un mois étant désormais écoulé, nous souhaiterions connaître la <strong>décision de votre service</strong> concernant cette demande.</p>
    </div>
    <table style="width:100%;background:#F5F5F0;border-radius:8px;padding:16px;margin:16px 0;border-collapse:collapse;">
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Référence interne</td><td style="padding:6px 12px;font-weight:700;">{{dossier_id}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">N° Demande Préalable</td><td style="padding:6px 12px;font-weight:700;">{{dp_number}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Date de dépôt</td><td style="padding:6px 12px;">{{date_envoi_dp}}</td></tr>
      <tr><td style="padding:6px 12px;color:#6B6B60;font-size:13px;">Client</td><td style="padding:6px 12px;">{{client_name}} — {{client_address}}</td></tr>
    </table>
    <p>Pourriez-vous nous communiquer <strong>l'accord ou l'arrêté de non-opposition</strong> à cette déclaration préalable de travaux, ou nous indiquer si des pièces complémentaires sont nécessaires ?</p>
    <p style="margin-top:24px;">Veuillez agréer l'expression de nos salutations distinguées,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
  <div style="background:#F5F5F0;padding:12px 24px;text-align:center;font-size:11px;color:#A0A090;border-radius:0 0 8px 8px;">
    Relance automatique — {{date_today}} — {{company_name}}
  </div>
</div>`,
    body_text: `Madame, Monsieur,\n\nRelance pour l'accord de la DP de {{client_name}} ({{client_address}}) déposée le {{date_envoi_dp}}.\nRéf: {{dossier_id}} — DP n°: {{dp_number}}\n\nMerci de nous communiquer la décision (accord / non-opposition).\n\n{{company_name}} — {{company_email}}`
  },
  {
    name: 'Récupération de TVA',
    subject: 'Dossier TVA — {{client_name}} — Réf. {{dossier_id}}',
    category: 'administration',
    variables: JSON.stringify(['client_name','client_address','dossier_id','date_today']),
    body_html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A1A16;">
  <div style="background:#1A4A8A;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:18px;">Eco-Formalités — Récupération TVA</h1>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #E8E8E0;border-top:none;">
    <p>Madame, Monsieur,</p>
    <p>Nous vous adressons la demande de récupération de TVA pour notre client <strong>{{client_name}}</strong>, domicilié au <strong>{{client_address}}</strong>.</p>
    <p>Référence dossier : <strong>{{dossier_id}}</strong> — Date : <strong>{{date_today}}</strong></p>
    <p>Vous trouverez en pièce jointe les justificatifs nécessaires (facture, attestation de travaux, KBIS si applicable).</p>
    <p style="margin-top:24px;">Cordialement,<br><strong>{{company_name}}</strong><br>{{company_email}}</p>
  </div>
</div>`,
    body_text: `Récupération TVA — {{client_name}} ({{client_address}}) — Réf: {{dossier_id}} — {{date_today}}\n\n{{company_name}} — {{company_email}}`
  },
];

// ── Seed templates ─────────────────────────────────────────────────────────────

function seedTemplates(db) {
  const now = new Date().toISOString();
  db.get('SELECT COUNT(*) as cnt FROM email_templates', [], (err, row) => {
    if (err || (row && row.cnt > 0)) return;
    const stmt = db.prepare(
      `INSERT INTO email_templates (name, subject, category, variables, body_html, body_text, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    DEFAULT_TEMPLATES.forEach(t => {
      stmt.run(t.name, t.subject, t.category, t.variables, t.body_html, t.body_text || '', now, now);
    });
    stmt.finalize();
    console.log(`✅ ${DEFAULT_TEMPLATES.length} templates email insérés`);
  });
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
            const result = await resend.emails.send({
              from: `${FROM_NAME} <${FROM_EMAIL}>`,
              to: row.to_name ? `${row.to_name} <${row.to_email}>` : row.to_email,
              subject: row.subject,
              html: row.body_html,
              text: row.body_text || undefined,
            });
            db.run(
              `UPDATE email_queue SET status='sent', sent_at=?, resend_id=? WHERE id=?`,
              [new Date().toISOString(), result.data?.id || null, row.id]
            );
            db.run(
              `INSERT INTO email_log (queue_id, dossier_id, to_email, subject, status, resend_id, sent_at)
               VALUES (?, ?, ?, ?, 'sent', ?, ?)`,
              [row.id, row.dossier_id, row.to_email, row.subject, result.data?.id || null, new Date().toISOString()]
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
              const vars = {
                ...dossierVars(d),
                date_envoi_dp: d.date_envoi_dp
                  ? new Date(d.date_envoi_dp).toLocaleDateString('fr-FR') : '',
              };
              const subject  = interpolate(tmpl.subject,   vars);
              const bodyHtml = interpolate(tmpl.body_html, vars);
              const bodyText = interpolate(tmpl.body_text, vars);
              await new Promise(res => db.run(
                `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [tmpl.id, d.id, toEmail, 'Service Urbanisme', subject, bodyHtml, bodyText, now, now],
                res
              ));
              db.run(`UPDATE dossiers SET relance_recepisee_at = ? WHERE id = ?`, [now, d.id]);
              console.log(`[CRON] Relance J+6 enqueued → ${toEmail} (dossier ${d.id})`);
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
              const vars = {
                ...dossierVars(d),
                date_envoi_dp: d.date_envoi_dp
                  ? new Date(d.date_envoi_dp).toLocaleDateString('fr-FR') : '',
              };
              const subject  = interpolate(tmpl.subject,   vars);
              const bodyHtml = interpolate(tmpl.body_html, vars);
              const bodyText = interpolate(tmpl.body_text, vars);
              await new Promise(res => db.run(
                `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [tmpl.id, d.id, toEmail, 'Service Urbanisme', subject, bodyHtml, bodyText, now, now],
                res
              ));
              db.run(`UPDATE dossiers SET relance_accord_dp_at = ? WHERE id = ?`, [now, d.id]);
              console.log(`[CRON] Relance J+30 enqueued → ${toEmail} (dossier ${d.id})`);
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

// POST /emails/send — envoyer immédiatement
router.post('/send', async (req, res) => {
  const {
    to, to_name, subject, body_html, body_text,
    template_id, dossier_id, variables: extraVars = {}
  } = req.body;

  if (!to) return res.status(400).json({ error: 'Destinataire (to) requis' });

  const doSend = async (finalSubject, finalHtml, finalText) => {
    try {
      const result = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: to_name ? `${to_name} <${to}>` : to,
        subject: finalSubject,
        html: finalHtml,
        text: finalText || undefined,
      });

      const now = new Date().toISOString();
      req.db.run(
        `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, sent_at, status, resend_id, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?)`,
        [template_id || null, dossier_id || null, to, to_name || null, finalSubject, finalHtml, finalText || '', now, now, result.data?.id || null, now]
      );
      req.db.run(
        `INSERT INTO email_log (dossier_id, to_email, subject, status, resend_id, sent_at)
         VALUES (?, ?, ?, 'sent', ?, ?)`,
        [dossier_id || null, to, finalSubject, result.data?.id || null, now]
      );

      res.json({ success: true, id: result.data?.id, message: 'Email envoyé' });
    } catch (err) {
      const errMsg = err.message || 'Erreur Resend';
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
    template_id, dossier_id, scheduled_at, variables: extraVars = {}
  } = req.body;

  if (!to || !scheduled_at) return res.status(400).json({ error: 'to et scheduled_at requis' });

  const doSchedule = (finalSubject, finalHtml, finalText) => {
    const now = new Date().toISOString();
    req.db.run(
      `INSERT INTO email_queue (template_id, dossier_id, to_email, to_name, subject, body_html, body_text, scheduled_at, status, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [template_id || null, dossier_id || null, to, to_name || null, finalSubject, finalHtml, finalText || '', scheduled_at, now],
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
