// Biometric WebAuthn Passkey + Secure PIN Lock utilities
import { sha256Hex } from './crypto';

const CREDENTIAL_ID_KEY = 'aether_webauthn_cred_id';
const PIN_HASH_KEY = 'aether_pin_hash';
const BIOMETRIC_ENABLED_KEY = 'aether_biometric_enabled';

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

export function isBiometricLockEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

export function hasPinConfigured(): boolean {
  return Boolean(localStorage.getItem(PIN_HASH_KEY));
}

export function hasPasskeyConfigured(): boolean {
  return Boolean(localStorage.getItem(CREDENTIAL_ID_KEY));
}

export async function setSecurityPin(pin: string): Promise<void> {
  const hash = await sha256Hex(`aether-pin:${pin}`);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function verifySecurityPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return true;
  const candidate = await sha256Hex(`aether-pin:${pin}`);
  return candidate === stored;
}

export function disableBiometricLock(): void {
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
}

export async function enrollBiometricPasskey(userEmail: string): Promise<{ ok: boolean; method: 'webauthn' | 'pin-fallback'; message: string }> {
  if (!isWebAuthnAvailable()) {
    return {
      ok: false,
      method: 'pin-fallback',
      message: 'Hardware passkeys are unavailable in this browser context. Use a 4-6 digit Security PIN.',
    };
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(userEmail);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Aether AI Assistant' },
        user: {
          id: userId,
          name: userEmail,
          displayName: userEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
        },
        timeout: 30000,
      },
    })) as PublicKeyCredential | null;

    if (cred) {
      const rawId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem(CREDENTIAL_ID_KEY, rawId);
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      return {
        ok: true,
        method: 'webauthn',
        message: 'Biometric passkey enrolled for Touch ID / Face ID unlock.',
      };
    }
    return { ok: false, method: 'pin-fallback', message: 'Enrollment cancelled.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Biometric enrollment restricted in embedded frame.';
    return {
      ok: false,
      method: 'pin-fallback',
      message: `${msg} Configure a Security PIN below for immediate lock protection.`,
    };
  }
}

export async function verifyBiometricPasskey(): Promise<{ ok: boolean; message: string }> {
  const storedId = localStorage.getItem(CREDENTIAL_ID_KEY);
  if (!storedId || !isWebAuthnAvailable()) {
    return { ok: false, message: 'No hardware passkey enrolled. Enter your Security PIN.' };
  }
  try {
    const rawBytes = Uint8Array.from(atob(storedId), (c) => c.charCodeAt(0));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: rawBytes }],
        userVerification: 'preferred',
        timeout: 30000,
      },
    });
    if (assertion) {
      return { ok: true, message: 'Biometric verification succeeded.' };
    }
    return { ok: false, message: 'Verification cancelled.' };
  } catch {
    return { ok: false, message: 'Biometric prompt unavailable here. Unlock with your Security PIN.' };
  }
}
