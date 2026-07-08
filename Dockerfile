# Base layer
FROM oven/bun:latest AS base
WORKDIR /usr/src/app

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production --ignore-scripts

# Copy node_modules from temp directory
# Then copy all (non-ignored) project files into the image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# Run as the non-root user bundled with the official Bun image instead of root
RUN chown -R bun:bun /usr/src/app
USER bun

ENTRYPOINT [ "bun", "start" ]