# Front TaskFlow : build Vite puis service statique nginx.
# nginx sert les fichiers construits et relaie /api vers l'API (API_UPSTREAM),
# ce qui garde le front et l'API sur la même origine (pas de CORS à configurer).

# --- Étape 1 : construction ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL reste vide : les appels /api sont relatifs et relayés par nginx.
RUN npm run build

# --- Étape 2 : exécution ---
FROM nginx:1.31-alpine
# Variables substituées au démarrage dans le template (mécanisme natif de l'image nginx).
ENV PORT=8080 \
    API_UPSTREAM=http://api:3000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" > /dev/null || exit 1
