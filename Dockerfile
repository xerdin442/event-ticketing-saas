FROM node:22

WORKDIR /usr/src/app

COPY package.json .

ARG NODE_ENV
RUN if [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "test" ]; \
      then npm install; \
      else npm install --only=production; \
      fi

COPY prisma ./prisma/

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD [ "npm", "start" ]