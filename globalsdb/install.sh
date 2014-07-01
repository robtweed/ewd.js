#!/usr/bin/env bash

# Install GlobalsDB, Node.js and EWD.js on Ubuntu System

# Update first just to be sure

sudo apt-get update
sudo apt-get install -y wget gzip openssh-server curl

# Install GlobalsDB

# First increase shared memory quotas

sudo sysctl -w kernel.shmall=536870912
sudo sysctl -w kernel.shmmax=536870912
sudo /bin/su -c "echo 'kernel.shmall=536870912' >> /etc/sysctl.conf"
sudo /bin/su -c "echo 'kernel.shmmax=536870912' >> /etc/sysctl.conf"

cd ~
wget http://globalsdb.org/sites/default/files/globals_2013.2.0.350.0_unix.tar.gz

gzip -cd globals_2013.2.0.350.0_unix.tar.gz | tar -x
rm globals_2013.2.0.350.0_unix.tar.gz
cd kit_unix_globals
mkdir ~/globalsdb
ISC_QUIET=yes
export ISC_QUIET
ISC_TGTDIR=~/globalsdb
export ISC_TGTDIR
ISC_PLATFORM=lnxsusex64
export ISC_PLATFORM
./installGlobals

cd ~
rm -rf kit_unix_globals

# Install NVM

curl https://raw.githubusercontent.com/creationix/nvm/v0.10.0/install.sh | sh
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

# Move the Node.js interface file into the correct place

mv ~/globalsdb/bin/cache0100.node ~/ewdjs/node_modules/cache.node

cd ~/ewdjs

# now ready to start EWD.js using:

# cd ~/ewdjs
# node ewdStart-gtm gtm-config


 