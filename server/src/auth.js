const jwt = require('jsonwebtoken');

function issueToken({ email, orgId, secret, expiresIn }) {
  return jwt.sign(
    {
      sub: email,
      orgId
    },
    secret,
    { expiresIn }
  );
}

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function requireAuth(config) {
  return (req, res, next) => {
    const token = readBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Missing Bearer token' });
    }

    try {
      const claims = jwt.verify(token, config.jwtSecret);
      const tokenOrgId =
        claims && typeof claims.orgId === 'string' && claims.orgId.trim()
          ? claims.orgId.trim()
          : config.defaultOrgId;
      const headerOrgId =
        typeof req.headers['x-org-id'] === 'string' ? req.headers['x-org-id'].trim() : '';

      if (headerOrgId && headerOrgId !== tokenOrgId) {
        return res.status(403).json({ ok: false, error: 'orgId mismatch for token' });
      }

      req.auth = {
        email: claims && typeof claims.sub === 'string' ? claims.sub : '',
        orgId: tokenOrgId
      };
      return next();
    } catch (_error) {
      return res.status(401).json({ ok: false, error: 'Invalid token' });
    }
  };
}

module.exports = {
  issueToken,
  requireAuth
};
