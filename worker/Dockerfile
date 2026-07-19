FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ansible \
    sshpass \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN useradd -m -u 1001 ansible && \
    chown -R ansible:ansible /app && \
    mkdir -p /tmp/ansible && \
    chown -R ansible:ansible /tmp/ansible

USER ansible

CMD ["node", "worker.js"]
