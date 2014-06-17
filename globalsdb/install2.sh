#!/usr/bin/env bash

source ~/.nvm/nvm.sh
nvm install 0.10.29
echo 'nvm use 0.10.29' >> ~/.profile

# Now ready to install EWD.js and Nodem:

cd ~
mkdir ewdjs
cd ewdjs
npm install ewdjs
npm install nodem

# Now install/configure EWD.js

cd node_modules/ewdjs
node install silent ~/ewdjs

# Move the Node.js interface file into the correct place

mv ~/globalsdb/bin/cache0100.node ~/ewdjs/node_modules/cache.node

cd ~/ewdjs

# now ready to start EWD.js using:

# cd ~/ewdjs
# node ewdStart-gtm gtm-config