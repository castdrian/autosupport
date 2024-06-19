# Base layer
FROM oven/bun:latest as base
WORKDIR /usr/src/app

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile --ignore-scripts

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production --ignore-scripts

# Copy node_modules from temp directory
# Then copy all (non-ignored) project files into the image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

ENTRYPOINT [ "bun", "start" ]