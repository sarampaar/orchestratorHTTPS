FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

# The startup command is defined in package.json (runs db push then starts server)
CMD ["npm", "start"]
