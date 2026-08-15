FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(0)).on('error',()=>process.exit(1))" || exit 1
CMD ["node", "src/index.js"]
