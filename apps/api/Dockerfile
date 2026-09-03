# syntax=docker/dockerfile:1.7
# ---- build : installe le monorepo, bundle l'API ----
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/constants/package.json packages/constants/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile --filter @salondz/api...
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @salondz/api build \
 && pnpm --filter @salondz/api deploy --prod --legacy /out \
 && cp -r apps/api/dist /out/dist

# ---- runtime : image minimale ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
