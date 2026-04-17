import { extractToken } from './api.utils';

describe('extractToken', () => {
  it('should return null if no header is provided', () => {
    expect(extractToken()).toBeNull();
    expect(extractToken(undefined)).toBeNull();
  });

  it('should return null if header does not match pattern', () => {
    expect(extractToken('Bearer abc123')).toBeNull();
    expect(extractToken('Token')).toBeNull();
    expect(extractToken('')).toBeNull();
  });

  it('should extract token correctly', () => {
    expect(extractToken('Token abc123')).toBe('abc123');
  });

  it('should be case insensitive', () => {
    expect(extractToken('token abc123')).toBe('abc123');
    expect(extractToken('TOKEN abc123')).toBe('abc123');
  });

  it('should trim whitespace around token', () => {
    expect(extractToken('Token    abc123   ')).toBe('abc123');
  });
});
