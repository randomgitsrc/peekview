import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validatePort,
  validateLogLevel,
  validateCorsOrigins,
} from '../src/config/validators';

describe('Config Validators', () => {
  describe('validateUrl', () => {
    it('should accept valid http URL', () => {
      expect(() => validateUrl('http://localhost:8080', 'url')).not.toThrow();
    });

    it('should accept valid https URL', () => {
      expect(() => validateUrl('https://example.com', 'url')).not.toThrow();
    });

    it('should reject URL without protocol', () => {
      expect(() => validateUrl('localhost:8080', 'url')).toThrow(
        'url: Must start with http:// or https://'
      );
    });

    it('should reject URL with only port number', () => {
      expect(() => validateUrl('13001', 'url')).toThrow(
        'url: Must start with http:// or https://'
      );
    });

    it('should reject empty URL', () => {
      expect(() => validateUrl('', 'url')).toThrow('url: Required');
    });

    it('should reject invalid URL format', () => {
      expect(() => validateUrl('http://[invalid]', 'url')).toThrow(
        'url: Invalid URL format'
      );
    });

    it('should accept localhost', () => {
      expect(() => validateUrl('http://localhost:8888', 'url')).not.toThrow();
    });

    it('should accept 127.0.0.1', () => {
      expect(() => validateUrl('http://127.0.0.1:8080', 'url')).not.toThrow();
    });
  });

  describe('validatePort', () => {
    it('should accept valid port as number', () => {
      expect(() => validatePort(33333, 'port')).not.toThrow();
    });

    it('should accept valid port as string', () => {
      expect(() => validatePort('33333', 'port')).not.toThrow();
    });

    it('should reject port number too low', () => {
      expect(() => validatePort(0, 'port')).toThrow(
        'port: Must be an integer between 1 and 65535'
      );
    });

    it('should reject port number too high', () => {
      expect(() => validatePort(65536, 'port')).toThrow(
        'port: Must be an integer between 1 and 65535'
      );
    });

    it('should reject non-numeric string', () => {
      expect(() => validatePort('abc', 'port')).toThrow(
        'port: Must be an integer between 1 and 65535'
      );
    });

    it('should reject float', () => {
      expect(() => validatePort(33333.5, 'port')).toThrow(
        'port: Must be an integer between 1 and 65535'
      );
    });
  });

  describe('validateLogLevel', () => {
    it('should accept debug', () => {
      expect(() => validateLogLevel('debug')).not.toThrow();
    });

    it('should accept info', () => {
      expect(() => validateLogLevel('info')).not.toThrow();
    });

    it('should accept warn', () => {
      expect(() => validateLogLevel('warn')).not.toThrow();
    });

    it('should accept error', () => {
      expect(() => validateLogLevel('error')).not.toThrow();
    });

    it('should accept uppercase', () => {
      expect(() => validateLogLevel('INFO')).not.toThrow();
    });

    it('should reject invalid level', () => {
      expect(() => validateLogLevel('verbose')).toThrow(
        'logging.level: Must be one of debug, info, warn, error'
      );
    });
  });

  describe('validateCorsOrigins', () => {
    it('should accept wildcard', () => {
      expect(() => validateCorsOrigins('*')).not.toThrow();
    });

    it('should accept single valid URL', () => {
      expect(() => validateCorsOrigins('http://localhost:5173')).not.toThrow();
    });

    it('should accept comma-separated URLs', () => {
      expect(() =>
        validateCorsOrigins('http://localhost:5173,https://example.com')
      ).not.toThrow();
    });

    it('should reject invalid URL', () => {
      expect(() => validateCorsOrigins('not-a-url')).toThrow(
        'CORS origin "not-a-url" is not a valid URL'
      );
    });

    it('should reject URL missing protocol', () => {
      expect(() => validateCorsOrigins('localhost:5173')).toThrow(
        'CORS origin "localhost:5173" is not a valid URL'
      );
    });
  });
});
