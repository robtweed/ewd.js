#!/usr/bin/env bash

# Install and configure a GT.M-based EWD.js System from scratch

# Update first just to be sure

sudo apt-get update
sudo apt-get install -y openssh-server

# Install GT.M

sudo apt-get install -y fis-gtm

# Create standard default database setup

cd /usr/lib/fis-gtm
dirs=( $(find . -maxdepth 1 -type d -printf '%P\n') )
cd ~
echo -e 'H\n' | /usr/lib/fis-gtm/${dirs[0]}/gtm -direct

# Install NVM (Node.js Version Manager)

sudo apt-get install -y curl
curl https://raw.githubusercontent.com/creationix/nvm/v0.7.0/install.sh | sh

source ~/.nvm/nvm.sh
nvm alias default 0.10
nvm install 0.10
nvm use default
echo 'nvm use default' >> ~/.profile

# Now ready to install EWD.js and Nodem:

cd ~
mkdir ewdjs
cd ewdjs
npm install ewdjs
npm install nodem

# Now install/configure EWD.js

cd node_modules/ewdjs
node install silent ~/ewdjs

# Change the Nodem mumps.node to the correct one:

cd ~/ewdjs/node_modules/nodem/lib
rm mumps.node
MACHINE_TYPE=`uname -m`
if [ ${MACHINE_TYPE} == 'x86_64' ]; then
  mv mumps10.node_x8664 mumps.node
else
  mv mumps10.node_i686 mumps.node
fi

# Set up symbolic link to libgtmshr so that it's available for use by NodeM

cd /usr/lib/fis-gtm
dirs=( $(find . -maxdepth 1 -type d -printf '%P\n') )
sudo ln -s /usr/lib/fis-gtm/${dirs[0]}/libgtmshr.so /usr/local/lib/libgtmshr.so
sudo ldconfig

cd ~/ewdjs


# now ready to start EWD.js using:

# cd ~/ewdjs
# node ewdStart-gtm gtm-config

