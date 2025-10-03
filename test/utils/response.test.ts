import { describe, it, expect } from 'vitest';
import { json } from '../../src/utils/response.js';

describe('Response Utils', () => {
  describe('json', () => {
    it('should create a JSON response with default status 200', () => {
      const data = { message: 'test', status: 'success' };
      const response = json(data);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should create a JSON response with custom status', () => {
      const data = { error: 'Not found' };
      const response = json(data, 404);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should create a JSON response with custom headers', () => {
      const data = { message: 'test' };
      const headers = { 'X-Custom-Header': 'test-value' };
      const response = json(data, 200, headers);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Custom-Header')).toBe('test-value');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should serialize complex objects correctly', async () => {
      const data = {
        message: 'test',
        nested: {
          array: [1, 2, 3],
          boolean: true,
          null: null
        },
        timestamp: new Date('2025-01-29T12:00:00Z')
      };

      const response = json(data);
      const result = await response.json() as any;

      expect(result.message).toBe(data.message);
      expect(result.nested).toEqual(data.nested);
      expect(result.timestamp).toBe('2025-01-29T12:00:00.000Z'); // Date becomes string in JSON
    });

    it('should handle circular references gracefully', () => {
      const data: any = { message: 'test' };
      data.self = data; // Create circular reference

      // This should not throw an error
      expect(() => json(data)).not.toThrow();
    });

    it('should handle undefined and null values', async () => {
      const data = {
        message: 'test',
        nullValue: null,
        undefinedValue: undefined
      };

      const response = json(data);
      const result = await response.json() as any;

      expect(result.message).toBe('test');
      expect(result.nullValue).toBeNull();
      expect('undefinedValue' in result).toBe(false); // undefined values are omitted
    });
  });
});
