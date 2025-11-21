@echo off
REM Build script for BioAuth Mobile (Windows)

echo Building BioAuth Mobile for web deployment...

REM Install dependencies
npm install

REM Build the web version
npx expo export:web

echo Build complete! The web version is ready in the web-build directory.