FROM node:20-alpine AS build
WORKDIR /app

COPY src/Web/ControlEasyReborn.Web/package.json src/Web/ControlEasyReborn.Web/package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY src/Web/ControlEasyReborn.Web/ .
# The checked-in client is regenerated and drift-checked by CI against the
# running API. Avoid invoking package.json's prebuild hook inside this isolated
# image build, where localhost cannot refer to the API service.
RUN npm run ng -- build --configuration production

FROM nginx:alpine AS runtime
COPY --from=build /app/dist/controleasy-reborn-web/browser /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
