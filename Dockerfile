FROM node:20-slim AS base
WORKDIR /app

# Install better-sqlite3 requirements
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Setting up directories (Volume mounted by Fly will sit at /data)
ENV DATA_DIR="/data"
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
