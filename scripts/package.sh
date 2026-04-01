#!/usr/bin/env bash

# Exit on error, undefined variables, and failed pipes
set -euo pipefail

echo "Installing production dependencies..."

# Install only production dependencies into dist/node_modules
yarn install --production=true --modules-folder ./dist/node_modules/

echo "Preparing e-mobility-backend..."

# Ensure dist/functions exists before proceeding
if [ ! -d "dist/functions" ]; then
  echo "Error: dist/functions does not exist. Did you run the build?"
  exit 1
fi

# Prepare backend package structure
mkdir -p dist/emobility-backend/dist/functions

# Move compiled Lambda functions into package folder
mv dist/functions/* dist/emobility-backend/dist/functions

# Remove original functions folder
rm -r dist/functions

echo "Preparing node-modules layer..."

# Create node_modules layer structure
mkdir -p dist/node-modules-layer/nodejs/node_modules

# Move production dependencies into Lambda layer
mv dist/node_modules/* dist/node-modules-layer/nodejs/node_modules

# Remove temporary node_modules folder
rm -r dist/node_modules

echo "Preparing common layer..."

# Ensure dist/common exists before proceeding
if [ ! -d "dist/common" ]; then
  echo "Error: dist/common does not exist. Did you compile shared code?"
  exit 1
fi

# Create common layer structure
mkdir -p dist/common-layer/nodejs

# Move shared code into Lambda layer
mv dist/common/* dist/common-layer/nodejs

# Remove original common folder
rm -r dist/common

echo "Zipping artifacts..."

# Zip backend package
(
  cd dist/emobility-backend || exit
  zip -rq ../emobility-backend.zip .
)

# Zip node_modules layer
(
  cd dist/node-modules-layer || exit
  zip -rq ../node-modules-layer.zip .
)

# Zip common layer
(
  cd dist/common-layer || exit
  zip -rq ../common-layer.zip .
)

echo "Build finished successfully"