FROM --platform=linux/arm64 node:22.14-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN apk add --no-cache git python3 py3-pip make g++
RUN npm ci

FROM --platform=linux/arm64 node:22.14-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN apk add --no-cache git python3 py3-pip make g++
RUN npm ci --loglevel=error --omit=dev

FROM --platform=linux/arm64 node:22.14-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM --platform=linux/arm64 node:22.14-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "start"]