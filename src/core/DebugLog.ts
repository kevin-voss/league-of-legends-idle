const PREFIX = "[IdleRifts]";

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (new URLSearchParams(window.location.search).has("debug")) {
    return true;
  }
  try {
    return window.localStorage.getItem("idle-rifts-debug") === "1";
  } catch {
    return false;
  }
}

export function debugLog(scope: string, message: string, data?: unknown): void {
  if (!isDebugEnabled()) {
    return;
  }
  if (data === undefined) {
    console.log(`${PREFIX}[${scope}] ${message}`);
    return;
  }
  console.log(`${PREFIX}[${scope}] ${message}`, data);
}

export function debugWarn(scope: string, message: string, data?: unknown): void {
  console.warn(`${PREFIX}[${scope}] ${message}`, data ?? "");
}

export function debugError(scope: string, message: string, data?: unknown): void {
  console.error(`${PREFIX}[${scope}] ${message}`, data ?? "");
}
