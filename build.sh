#!/bin/bash
# Build script for BioAuth Mobile

echo "Building BioAuth Mobile for web deployment..."

# Install dependencies
npm install

# Build the web version
npx expo export:web

echo "Build complete! The web version is ready in the web-build directory."