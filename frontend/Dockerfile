# Frontend Dockerfile — multi-stage build

# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build args for runtime API URLs (baked into the Vite bundle)
ARG VITE_AUTH_URL=http://localhost:8001
ARG VITE_POST_URL=http://localhost:8002
ARG VITE_FEED_URL=http://localhost:8003
ARG VITE_NOTIF_URL=http://localhost:8004
ARG VITE_NOTIF_WS_URL=ws://localhost:8004

ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_POST_URL=$VITE_POST_URL
ENV VITE_FEED_URL=$VITE_FEED_URL
ENV VITE_NOTIF_URL=$VITE_NOTIF_URL
ENV VITE_NOTIF_WS_URL=$VITE_NOTIF_WS_URL

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
