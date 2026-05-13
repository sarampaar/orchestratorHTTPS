FROM node:18-alpine

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
