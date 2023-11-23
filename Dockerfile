FROM pedromol/zerozerocat:deps

ENV NODE_PATH=/usr/lib/node_modules

COPY index.js /app

WORKDIR /app
