FROM node:22

WORKDIR /usr/src/app

COPY package.json .

ARG NODE_ENV
RUN if [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "test" ]; \
      then npm ci; \
      else npm ci --only=production; \
      fi

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]