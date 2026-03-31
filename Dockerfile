#
# Production image for Mikael (React client build + Node/Express server)
#

# 1) Build client
FROM node:20-alpine AS client_build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/

# Install root deps (concurrently) + server/client deps
RUN npm ci
RUN cd server && npm ci
RUN cd client && npm ci

COPY client ./client
COPY server ./server

RUN cd client && npm run build

# 2) Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY --from=client_build /app/client/build ./client/build

EXPOSE 5000
CMD ["node", "server/index.js"]



