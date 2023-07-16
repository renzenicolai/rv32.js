#!/usr/bin/env bash

set -e

cd program
./build.sh
cd ..
node main.js