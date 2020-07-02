FROM node:12.18.0-alpine3.11

WORKDIR /usr/src/app

COPY ./package.json ./
COPY ./package-lock.json ./

RUN npm ci

COPY ./ ./

RUN npm run build

CMD [ "npm", "run", "start" ]
