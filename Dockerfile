# Dependencies stage - for better caching
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --legacy-peer-deps && \
    cp -R node_modules /tmp/node_modules && \
    npm ci --legacy-peer-deps

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Set to production
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Copy production dependencies from deps stage
COPY --from=deps /tmp/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "dist/main"]
