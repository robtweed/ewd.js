#!/usr/bin/env bash

source ~/.nvm/nvm.sh
nvm install 0.10.28
echo 'nvm use 0.10.28' >> ~/.profile

# Now ready to install EWD.js and Nodem:

cd ~
mkdir ewdjs
cd ewdjs
npm install ewdjs
npm install nodem

# Now install/configure EWD.js

cd node_modules/ewdjs
node install silent /home/vista/ewdjs

# Change the Nodem mumps.node to the correct one:

cd ~/ewdjs/node_modules/nodem/lib
rm mumps.node
mv mumps10.node_i686 mumps.node

# now ready to start EWD.js using:

# cd ~/ewdjs
# node ewdStart-gtm dewdrop-config



