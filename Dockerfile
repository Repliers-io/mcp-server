FROM node:26.8-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3001

ENTRYPOINT ["node", "mcpServer.js", "--http"]