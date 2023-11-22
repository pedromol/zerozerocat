FROM pedromol/zerozerocat:base

ENV NODE_PATH=/usr/lib/node_modules

COPY index.js /app

WORKDIR /app
