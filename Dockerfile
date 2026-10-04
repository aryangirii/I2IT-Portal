FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S placement && adduser -S placement -G placement
COPY --from=build --chown=placement:placement /app/.next/standalone ./
COPY --from=build --chown=placement:placement /app/.next/static ./.next/static
COPY --from=build --chown=placement:placement /app/public ./public
USER placement
EXPOSE 3000
CMD ["node", "server.js"]
