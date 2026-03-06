# Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Accept build arguments
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
# Nginx official image handles .template files in /etc/nginx/templates/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV BACKEND_URL=http://backend:54321

# Default Nginx port is 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
