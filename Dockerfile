FROM urielch/opencv-nodejs

ENV NODE_PATH=/usr/lib/node_modules

COPY . /app

WORKDIR /app
RUN npm i
