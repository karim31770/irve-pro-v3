FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4010

# Lance les migrations au démarrage (idempotent), puis démarre l’API
CMD ["sh", "-c", "node migrate.js && node server.js"]
