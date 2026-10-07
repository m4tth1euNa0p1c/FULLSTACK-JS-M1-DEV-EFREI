module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // Variables d'environnement de test : chargées avant tout import de l'application.
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  // Le premier démarrage de mongodb-memory-server peut être lent (téléchargement du binaire).
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
