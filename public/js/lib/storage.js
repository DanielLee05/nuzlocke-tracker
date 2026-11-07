// Typed localStorage access.

export function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
