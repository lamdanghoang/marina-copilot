// Secure Storage — encrypt sensitive data in sessionStorage-keyed AES-GCM

const ENCRYPTION_KEY_NAME = "copilot_session_key";

async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
  if (stored) {
    try {
      const keyData = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
      return await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    } catch {
      sessionStorage.removeItem(ENCRYPTION_KEY_NAME);
    }
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const exported = await crypto.subtle.exportKey("raw", key);
  sessionStorage.setItem(ENCRYPTION_KEY_NAME, btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)))));
  return key;
}

export async function secureSet(key: string, value: string): Promise<void> {
  const encKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encKey, new TextEncoder().encode(value));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  localStorage.setItem(key, btoa(String.fromCharCode.apply(null, Array.from(combined))));
}

export async function secureGet(key: string): Promise<string | null> {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    const encKey = await getEncryptionKey();
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, encKey, combined.slice(12));
    return new TextDecoder().decode(decrypted);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function secureClearAll(): void {
  ["zklogin_jwt", "zklogin_salt", "zklogin_ephemeral_key", "zklogin_randomness", "zklogin_max_epoch"].forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem(ENCRYPTION_KEY_NAME);
}
