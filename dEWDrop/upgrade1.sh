#!/usr/bin/env bash

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

sudo chattr -i ¬/.profile
curl https://raw.githubusercontent.com/creationix/nvm/v0.7.0/install.sh | sh