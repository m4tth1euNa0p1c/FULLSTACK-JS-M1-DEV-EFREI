# API TaskFlow : image de production (Node.js 20, dépendances de production uniquement).
# Image glibc (Debian slim) plutôt qu'Alpine : bcrypt dispose de binaires précompilés
# pour cette cible, aucune compilation native n'est nécessaire.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
# --omit=dev : ni Jest, ni mongodb-memory-server (et donc aucun téléchargement de binaire MongoDB)
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Processus non privilégié fourni par l'image officielle
USER node

EXPOSE 3000

# La route de santé fait foi : l'orchestrateur (compose, Cloud Run) attend un 200.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
