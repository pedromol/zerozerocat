FROM pedromol/zerozerocat:deps

ENV NODE_PATH=/usr/lib/node_modules

COPY src /app/src

WORKDIR /app

RUN npm run build
