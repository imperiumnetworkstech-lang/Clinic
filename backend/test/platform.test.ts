import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/lib/crypto.js';
import { api } from './helpers.js';

describe('platform', () => {
  it('reports health and database readiness', async () => {
    expect((await api().get('/health')).body).toEqual({ status: 'ok' });
    expect((await api().get('/ready')).body).toEqual({ status: 'ready' });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows CORS only for configured origins', async () => {
    const allowed = await api().get('/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const denied = await api().get('/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns problem+json for unknown routes and malformed JSON', async () => {
    const missing = await api().get('/api/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('route_not_found');

    const malformed = await api()
      .post('/api/v1/auth/staff/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('malformed_json');
  });

  it('serves the OpenAPI document outside production', async () => {
    const res = await api().get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/api/v1/auth/staff/login'].post.requestBody).toBeDefined();
  });

  it('round-trips field encryption with a fresh IV each time', () => {
    const first = encrypt('Allergic to penicillin');
    const second = encrypt('Allergic to penicillin');
    expect(first).not.toBe(second);
    expect(decrypt(first)).toBe('Allergic to penicillin');
    expect(() => decrypt(first.replace(/.$/, 'A'))).toThrow();
  });
});
