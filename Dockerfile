FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
