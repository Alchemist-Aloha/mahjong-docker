# Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
# Default Nginx port is 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
