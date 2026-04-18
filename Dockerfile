# ─── Stage 1: Build Frontend ───
FROM node:18 AS client-builder
WORKDIR /app
COPY client/package.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# ─── Stage 2: Production Server ───
FROM node:18-alpine
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/app.js"]
