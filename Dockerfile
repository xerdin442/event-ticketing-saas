FROM node:22

WORKDIR /usr/src/app

COPY package.json ./

COPY prisma ./prisma

RUN mkdir -p prisma/generated

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
