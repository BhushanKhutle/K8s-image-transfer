FROM docker.rril.ril.com/testing/docker/node:20-alpine

RUN apk add --no-cache openssh-client sshpass

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --production

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/k8s-transfer.db

EXPOSE 3001

CMD ["node", "dist/index.js"]

