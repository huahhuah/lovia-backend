FROM node:20-alpine3.19
ENV NODE_ENV=production

WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "run", "start"]