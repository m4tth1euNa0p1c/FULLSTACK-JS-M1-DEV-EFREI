const env = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');
const { createApp } = require('./app');

async function main() {
  await connectDb(env.mongoUri);
  console.log(`MongoDB connecté (${env.nodeEnv})`);

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API TaskFlow disponible sur http://localhost:${env.port}/api`);
    console.log(`Documentation Swagger : http://localhost:${env.port}/api/docs`);
  });

  // Arrêt propre (Ctrl+C) : on ferme le serveur HTTP puis la connexion MongoDB.
  const shutdown = async () => {
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Démarrage impossible :', err.message);
  process.exit(1);
});
