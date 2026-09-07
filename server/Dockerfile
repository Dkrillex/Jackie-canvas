# 充值服务。和前端镜像分开：前端是纯静态的 nginx，这个要常驻进程跑兜底对账。
FROM node:20-alpine AS build

WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "dist/index.js"]
