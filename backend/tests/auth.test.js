const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const { connectTestDb, clearTestDb, disconnectTestDb } = require('./setup/db');

const app = createApp();
const credentials = { email: 'alice@example.test', password: 'MotDePasse123!' };

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('POST /api/auth/register', () => {
  it('crée un compte : 201, {user:{id,email}, token} et JWT signé valide', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email: 'alice@example.test' },
      token: expect.any(String),
    });

    // Le jeton est bien signé avec la clé serveur et identifie l'utilisateur créé.
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("n'expose ni mot de passe ni hash, et ne stocke que le hash bcrypt", async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain(credentials.password);

    const stored = await User.findOne({ email: credentials.email }).lean();
    expect(stored.password).toBeUndefined();
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toBe(credentials.password);
  });

  it("normalise l'email en minuscules", async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Alice@Example.TEST', password: credentials.password });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.test');
  });

  it('refuse un email déjà utilisé avec 409 EMAIL_ALREADY_USED, quelle que soit la casse', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ALICE@example.test', password: 'AutreMotDePasse1' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_ALREADY_USED', message: expect.any(String) },
    });
  });

  it.each([
    ['email invalide', { email: 'pas-un-email', password: 'MotDePasse123!' }],
    ['email manquant', { password: 'MotDePasse123!' }],
    ['mot de passe trop court (7)', { email: 'a@b.fr', password: '1234567' }],
    ['mot de passe manquant', { email: 'a@b.fr' }],
    ['mot de passe non textuel', { email: 'a@b.fr', password: 12345678 }],
    ['champ inconnu', { email: 'a@b.fr', password: 'MotDePasse123!', role: 'admin' }],
    ['corps tableau', [{ email: 'a@b.fr', password: 'MotDePasse123!' }]],
  ])('refuse un corps invalide (%s) avec 400 INVALID_INPUT', async (_label, body) => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it('refuse un corps absent avec 400', async () => {
    const res = await request(app).post('/api/auth/register');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(credentials);
  });

  it('connecte un utilisateur : 200 et même schéma que register', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email: 'alice@example.test' },
      token: expect.any(String),
    });
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).sub).toBe(res.body.user.id);
  });

  it("accepte l'email avec une casse différente", async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ALICE@EXAMPLE.test', password: credentials.password });
    expect(res.status).toBe(200);
  });

  it('refuse un mauvais mot de passe avec 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'MauvaisMotDePasse' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
  });

  it('refuse un email inconnu avec 401 et le même message (pas de fuite)', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'MauvaisMotDePasse' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@example.test', password: credentials.password });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.code).toBe('UNAUTHORIZED');
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('refuse un corps invalide avec 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});
