/**
 * FNV-1a 32-bit checksum for detecting accidental local queue changes.
 * This is not cryptographic and must never be used as server-side authentication.
 */
export function computeFnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  const prime = 0x01000193;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit integer multiplication
    hash = Math.imul(hash, prime) >>> 0;
  }

  // Format as 8-character zero-padded lowercase hex
  return hash.toString(16).padStart(8, '0');
}

export interface OfflinePunchPayload {
  employeeId: string;
  timestamp: string; // ISO string
  type: string; // 'CHECK_IN' | 'CHECK_OUT'
  latitude: number;
  longitude: number;
}

export function generatePunchSignature(payload: OfflinePunchPayload): string {
  const normalized = `${payload.employeeId}:${payload.timestamp}:${payload.type}:${payload.latitude.toFixed(6)}:${payload.longitude.toFixed(6)}`;
  return computeFnv1a32Hex(normalized);
}

export function verifyPunchSignature(
  payload: OfflinePunchPayload,
  providedSignature: string,
): boolean {
  const expectedSignature = generatePunchSignature(payload);
  return expectedSignature.toLowerCase() === providedSignature.toLowerCase();
}
