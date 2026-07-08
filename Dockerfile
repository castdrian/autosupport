FROM oven/bun:latest AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production --ignore-scripts

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

RUN chown -R bun:bun /usr/src/app
USER bun

ENTRYPOINT [ "bun", "start" ]
