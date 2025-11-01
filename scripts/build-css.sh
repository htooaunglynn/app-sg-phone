#!/bin/bash
echo "Building Tailwind CSS..."

# Use Tailwind CLI to build from input.css
npx tailwindcss -i ./public/css/input.css -o ./public/css/tailwind-compiled.css

echo "Tailwind CSS compiled successfully!"
