#!/usr/bin/env bash

# Upgrade dEWDrop 5 VM to latest Node.js, NodeM and EWD.js, configure ready to run

# Upgrade Node.js

sudo rm -rf /home/vista/.npm
sudo rm -rf /usr/lib/node_modules
sudo rm -rf /etc/profile.d/nodejs.sh
sudo rm -rf /usr/share/doc/nodejs-dev
sudo rm -rf /usr/share/doc/nodejs
sudo rm -rf /usr/share/man/man1/node*
sudo rm -rf /usr/share/nodejs
sudo rm -rf /usr/include/nodejs
sudo rm -rf /usr/lib/nodejs
sudo rm -rf /usr/bin/node
sudo rm -rf /usr/bin/node*
sudo rm -rf /var/lib/dpkg/info/nodejs*
sudo rm -rf /var/lib/dpkg/alternatives/node*
sudo rm -rf /usr/lib/dtrace/node.d
sudo rm -rf /etc/alternatives/npm
sudo rm -rf /usr/share/doc/npm
sudo rm -rf /usr/bin/npm
sudo rm -rf /var/lib/dpkg/alternatives/npm

# Install NVM and use it to install latest Node.js

sudo chattr -i ~/.profile
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
node install silent /home/vista/ewdjs

# Change the Nodem mumps.node to the correct one:

cd ~/ewdjs/node_modules/nodem/lib
rm mumps.node
mv mumps10.node_i686 mumps.node

cd ~/ewdjs

# now ready to start EWD.js using:

# cd ~/ewdjs
# node ewdStart-gtm dewdrop-config



