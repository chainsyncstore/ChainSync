import request from 'supertest';
import app from '../index';

describe('Health check', () => {
  it('should return 404 for unknown route', async() => {
    const res = await request(app).get('/unknown');
    expect(res.statusCode).toBe(404);
  });
});
