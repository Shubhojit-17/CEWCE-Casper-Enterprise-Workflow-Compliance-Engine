import { generateToken, verifyToken, decodeToken, TokenPayload } from '../../lib/jwt.js';

// Mock config for testing
jest.mock('../../lib/config.js', () => ({
  config: {
    jwtSecret: 'test-secret-key-at-least-32-chars-long',
    jwtExpiry: '1h',
  },
}));

describe('JWT Utilities', () => {
  const mockPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
    userId: 'test-user-id',
    publicKey: '02abc123',
    roles: ['admin'],
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateToken(mockPayload);
      const decoded = verifyToken(token);
      
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.publicKey).toBe(mockPayload.publicKey);
      expect(decoded.roles).toEqual(mockPayload.roles);
    });

    it('should throw for invalid tokens', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const token = generateToken(mockPayload);
      const decoded = decodeToken(token);
      
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid tokens', () => {
      const decoded = decodeToken('not-a-jwt');
      expect(decoded).toBeNull();
    });
  });
});
