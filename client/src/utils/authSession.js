export const authStorageKey = "smart-water-map-auth";
export const authSessionUpdatedEvent = "smart-water-map-auth:update";

const emptySession = {
  user: null,
  token: null,
  refreshToken: null,
  rememberMe: false,
  expiresAt: null,
  refreshExpiresAt: null
};

export function readAuthSession() {
  return normalizeSession(readRawSession(window.localStorage) || readRawSession(window.sessionStorage));
}

export function writeAuthSession(session) {
  const next = normalizeSession(session);
  window.localStorage.removeItem(authStorageKey);
  window.sessionStorage.removeItem(authStorageKey);
  const storage = next.rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(authStorageKey, JSON.stringify(next));
  notifyAuthSessionUpdated(next);
  return next;
}

export function clearAuthSession() {
  window.localStorage.removeItem(authStorageKey);
  window.sessionStorage.removeItem(authStorageKey);
  notifyAuthSessionUpdated(emptySession);
}

export function buildAuthSession(data, rememberMe) {
  const now = Date.now();
  return normalizeSession({
    user: data?.user || null,
    token: data?.accessToken || data?.token || null,
    refreshToken: data?.refreshToken || null,
    rememberMe: Boolean(rememberMe),
    expiresAt: data?.expiresIn ? now + Number(data.expiresIn) * 1000 : null,
    refreshExpiresAt: data?.refreshExpiresIn ? now + Number(data.refreshExpiresIn) * 1000 : null
  });
}

function readRawSession(storage) {
  try {
    const persisted = JSON.parse(storage.getItem(authStorageKey) || "null");
    return persisted?.state || persisted;
  } catch {
    return null;
  }
}

function normalizeSession(session) {
  if (!session) return { ...emptySession };
  return {
    user: session.user || null,
    token: session.token || null,
    refreshToken: session.refreshToken || null,
    rememberMe: Boolean(session.rememberMe),
    expiresAt: session.expiresAt || null,
    refreshExpiresAt: session.refreshExpiresAt || null
  };
}

function notifyAuthSessionUpdated(session) {
  window.dispatchEvent(new CustomEvent(authSessionUpdatedEvent, { detail: session }));
}
