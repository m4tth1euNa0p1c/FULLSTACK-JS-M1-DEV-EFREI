// Environnement de test : aucune valeur ne vient du fichier .env de développement.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secret-de-test-uniquement';
process.env.JWT_EXPIRES_IN = '1h';
// Coût bcrypt réduit pour accélérer la suite ; 10 reste la valeur de production.
process.env.BCRYPT_ROUNDS = '4';
