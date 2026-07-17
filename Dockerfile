# RX WA — Dockerfile (Render-ready)
# node:18-slim = Debian/glibc → better-sqlite3 ships a prebuilt binary (no source compile)
FROM node:18-slim
WORKDIR /app

# Install deps first (cached layer). Order matters: COPY package files BEFORE source.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy app source (node_modules excluded via .dockerignore)
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
