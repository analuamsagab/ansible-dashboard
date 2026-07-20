FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ansible \
    sshpass \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data && \
    useradd -m -u 1001 ansible && \
    chown -R ansible:ansible /data /app

USER ansible

EXPOSE 3001

CMD ["node", "src/index.js"]
