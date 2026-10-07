const mongoose = require('mongoose');

/**
 * Base MongoDB de test, isolée de la base de développement.
 *
 * - Par défaut : un serveur MongoDB éphémère en mémoire (mongodb-memory-server),
 *   donc aucun risque de toucher aux données de développement.
 * - Si MONGO_URI_TEST est défini (ex. en CI avec un conteneur Mongo) : on s'y connecte,
 *   mais toujours dans une base dédiée nommée taskflow_test_<identifiant unique>,
 *   supprimée à la fin du fichier de test.
 */
let mongod = null;
let uri = null;
let dbName = null;

async function connectTestDb() {
  if (process.env.MONGO_URI_TEST) {
    uri = process.env.MONGO_URI_TEST;
  } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  dbName = `taskflow_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(uri, { dbName });
}

/** Vide toutes les collections : chaque test repart d'un état connu. */
async function clearTestDb() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/**
 * Simule un redémarrage de l'API : on coupe la connexion Mongoose puis on la rouvre
 * sur la même base. Le processus MongoDB, lui, continue de tourner : les données
 * survivent si elles ont bien été écrites en base.
 */
async function restartDbConnection() {
  await mongoose.disconnect();
  await mongoose.connect(uri, { dbName });
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

module.exports = { connectTestDb, clearTestDb, restartDbConnection, disconnectTestDb };
