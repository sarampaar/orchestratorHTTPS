FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

CMD ["sh", "-c", "sleep 5 && npx prisma db push --accept-data-loss && npm start"]
