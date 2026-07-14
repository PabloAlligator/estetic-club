'use strict';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? '__Host-nadia_admin_session'
  : 'nadia_admin_session';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

function getSessionCookieClearOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/',
  };
}

module.exports = {
  IS_PRODUCTION,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  getSessionCookieOptions,
  getSessionCookieClearOptions,
};
