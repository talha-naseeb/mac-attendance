import {
  computeFnv1a32Hex,
  generatePunchSignature,
  verifyPunchSignature,
} from './fnv1a.util';

describe('FNV-1a 32-bit Cryptographic Sealing Utility', () => {
  it('computes deterministic 8-character hex hash', () => {
    const hash1 = computeFnv1a32Hex('EMP-001:2026-10-24T08:00:00.000Z:CHECK_IN:24.713600:46.675300');
    const hash2 = computeFnv1a32Hex('EMP-001:2026-10-24T08:00:00.000Z:CHECK_IN:24.713600:46.675300');

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(8);
  });

  it('verifies valid punch signature', () => {
    const payload = {
      employeeId: 'EMP-002',
      timestamp: '2026-10-24T08:30:00.000Z',
      type: 'CHECK_IN',
      latitude: 24.7136,
      longitude: 46.6753,
    };

    const signature = generatePunchSignature(payload);
    expect(verifyPunchSignature(payload, signature)).toBe(true);
  });

  it('detects tampering when coordinates or timestamps are altered', () => {
    const originalPayload = {
      employeeId: 'EMP-002',
      timestamp: '2026-10-24T08:30:00.000Z',
      type: 'CHECK_IN',
      latitude: 24.7136,
      longitude: 46.6753,
    };

    const signature = generatePunchSignature(originalPayload);

    // Tampered payload with spoofed latitude
    const tamperedPayload = {
      ...originalPayload,
      latitude: 24.7140,
    };

    expect(verifyPunchSignature(tamperedPayload, signature)).toBe(false);
  });
});
