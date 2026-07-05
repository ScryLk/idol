import { parseLevelScript, type LevelScript } from '../schemas/level.js';

/**
 * Codec do LevelScript para transporte via URL (editor → game): JSON →
 * UTF-8 → base64url. O decode SEMPRE valida pelo schema Zod — payload
 * adulterado ou de versão incompatível é rejeitado.
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeLevelScript(script: LevelScript): string {
  const validated = parseLevelScript(script);
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(validated)));
}

/** Lança (ZodError/SyntaxError) se o payload for inválido. */
export function decodeLevelScript(encoded: string): LevelScript {
  const json = new TextDecoder().decode(base64UrlToBytes(encoded));
  return parseLevelScript(JSON.parse(json));
}
