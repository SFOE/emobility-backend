#!/usr/bin/env bash

echo "Installing production dependencies..."
yarn install --production=true --modules-folder ./dist/node_modules/

echo "Preparing emobility-backend..."
mkdir -p dist/emobility-backend/dist/functions
mv dist/functions/* dist/emobility-backend/dist/functions
rm -r dist/functions

echo "Preparing node-modules layer..."
mkdir -p dist/node-modules-layer/nodejs/node_modules
mv dist/node_modules/* dist/node-modules-layer/nodejs/node_modules
rm -r dist/node_modules

echo "Preparing common layer..."
mkdir -p dist/common-layer/nodejs
mv dist/common/* dist/common-layer/nodejs
rm -r dist/common

shopt -s nullglob
for d in dist/*/; do
  name="$(basename "$d")"
  echo "Zipping $name..."

  (
    cd "$d" || exit
    zip -rq "../$name.zip" .
  )
done

echo "Build finished successfully"
