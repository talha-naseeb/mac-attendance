import { generateTemporaryPassword } from './credentials.util';

describe('generateTemporaryPassword', () => {
  it('produces four distinct 16-character credentials with every character class', () => {
    const values = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      const value = generateTemporaryPassword();
      values.add(value);
      expect(value).toHaveLength(16);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[^A-Za-z0-9]/);
    }
    expect(values.size).toBe(4);
  });
});
