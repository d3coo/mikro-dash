# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install bun for package management
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies for better-sqlite3 and ADB for monitor control
RUN apt-get update && apt-get install -y \
    libsqlite3-0 \
    adb \
    && rm -rf /var/lib/apt/lists/*

# Copy built app and dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy static APK files for monitor setup
COPY --from=builder /app/static/apk ./static/apk

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "build/index.js"]
