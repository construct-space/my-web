# ─── Stage 1: build the Vue SPA ──────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS spa

WORKDIR /app

# Copy the full workspace (gateway's job is to ship the SPA; we need the
# workspace because core depends on workspace packages: ui-web, infra-shell, etc.)
COPY package.json bun.lock ./
COPY core/package.json ./core/
COPY packages/ ./packages/
COPY spaces/ ./spaces/

RUN bun install --frozen-lockfile

COPY core/ ./core/

# Production SPA build
ENV VITE_PUBLIC_URL=https://my.lisaos.dev
RUN cd core && bun run build

# ─── Stage 2: nginx serving SPA + proxying /api/* ────────────────────────────
FROM nginx:1.27-alpine AS runtime

# envsubst for templating nginx.conf at startup (upstream IPs + shared secret
# come from env vars set by CapRover, not baked into the image)
RUN apk add --no-cache gettext

COPY --from=spa /app/core/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY snippets/ /snippets/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && rm /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
