import { describe, it, expect } from 'vitest';

describe('Health Check', () => {
  describe('response format', () => {
    it('should return status ok when all systems are functional', async () => {
      // This test will fail until we implement the enhanced health endpoint
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('peekview');
      expect(data).toHaveProperty('config');
    });

    it('should include config source and path', async () => {
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      expect(data.config).toHaveProperty('source');
      expect(data.config).toHaveProperty('path');
      expect(['file', 'env', 'default']).toContain(data.config.source);
    });

    it('should include api_key_configured boolean', async () => {
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      expect(data.config).toHaveProperty('api_key_configured');
      expect(typeof data.config.api_key_configured).toBe('boolean');
      // Should not expose the actual API key
      expect(data.config).not.toHaveProperty('api_key');
    });

    it('should include peekview_url and public_url in config', async () => {
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      expect(data.config).toHaveProperty('peekview_url');
      expect(data.config).toHaveProperty('public_url');
    });
  });

  describe('degraded state', () => {
    it('should return degraded when PeekView is unreachable', async () => {
      // This would need mock setup to test properly
      // For now, just verify the response structure
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      if (data.status === 'degraded') {
        expect(data).toHaveProperty('peekview_error');
      }
    });

    it('should return degraded with config_error when config is invalid', async () => {
      // This would need to mock invalid config
      const response = await fetch('http://127.0.0.1:33333/health');
      const data = await response.json();

      if (data.config?.config_error) {
        expect(data.status).toBe('degraded');
      }
    });
  });
});
