FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p data public
EXPOSE 3000
CMD ["npm", "start"]
