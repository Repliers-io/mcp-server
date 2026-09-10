FROM node:26.8-alpine

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 3001

CMD ["node", "mcpServer.js", "--http"]
