'use strict';

function createRoleGuard(pageMode, allowedRoles) {
  const roles = new Set(allowedRoles);

  return function roleGuard(req, res, next) {
    if (!req.auth?.user) {
      if (pageMode) {
        return res.redirect(303, '/admin/login');
      }

      return res.status(401).json({
        message: 'Требуется авторизация',
      });
    }

    if (!roles.has(req.auth.user.role)) {
      if (pageMode) {
        return res.status(403).send(
          'Недостаточно прав для открытия этой страницы',
        );
      }

      return res.status(403).json({
        message: 'Недостаточно прав',
      });
    }

    return next();
  };
}

function requireRole(...allowedRoles) {
  return createRoleGuard(false, allowedRoles);
}

requireRole.page = function requirePageRole(...allowedRoles) {
  return createRoleGuard(true, allowedRoles);
};

module.exports = requireRole;
