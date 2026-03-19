const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-eco-formalites-2024';

/**
 * Middleware d'authentification JWT.
 * Vérifie le header Authorization: Bearer <token>
 * et injecte req.user = { id, email, role }
 */
function authMiddleware(req, res, next) {
  // Routes publiques : login, health, share links
  const publicPaths = ['/api/login', '/api/register', '/api/health', '/api/share/'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant. Authentification requise.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role, name }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ error: 'Token invalide.' });
  }
}

/**
 * Génère un JWT pour un utilisateur authentifié.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Middleware de vérification de rôle admin.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }
  next();
}

module.exports = { authMiddleware, generateToken, requireAdmin, JWT_SECRET };
