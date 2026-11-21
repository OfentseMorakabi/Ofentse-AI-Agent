// Real client-side Web Crypto AES-256-GCM encryption & PBKDF2 key derivation

function bufToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 150000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload<T>(
  data: T,
  passphrase: string
): Promise<{
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
  checksumSha256: string;
  sizeBytes: number;
}> {
  const json = JSON.stringify(data);
  const encoded = new TextEncoder().encode(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );
  const checksumSha256 = await sha256Hex(json);

  return {
    ivBase64: bufToBase64(iv),
    saltBase64: bufToBase64(salt),
    ciphertextBase64: bufToBase64(encrypted),
    checksumSha256,
    sizeBytes: encrypted.byteLength,
  };
}

export async function decryptPayload<T>(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  passphrase: string
): Promise<T> {
  const iv = base64ToBuf(ivBase64);
  const salt = base64ToBuf(saltBase64);
  const ciphertext = base64ToBuf(ciphertextBase64);
  const key = await deriveAesKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as T;
}

export function getOrCreateDeviceId(): string {
  const key = 'aether_device_id';
  let existing = localStorage.getItem(key);
  if (!existing) {
    existing = `dev-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(key, existing);
  }
  return existing;
}
