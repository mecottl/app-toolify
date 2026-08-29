# Toolify — imagen lista para Render / Railway / Fly.io / Cloud Run
FROM node:20-bookworm-slim

# ffmpeg + yt-dlp (binario autónomo de Linux, no necesita Python)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=4747
EXPOSE 4747

CMD ["node", "server.js"]
