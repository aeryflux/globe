#!/bin/bash
# Build and deploy to all local targets
npx tsup && \
cp -r dist/* ../lumos/node_modules/@aeryflux/globe/dist/ && \
cp -r dist/* ../aeryflux-core/node_modules/@aeryflux/globe/dist/ && \
cp -r dist/* ../globe-demo/node_modules/@aeryflux/globe/dist/ && \
echo "✓ Deployed to lumos + atlas + globe-demo"
