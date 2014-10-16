#!/usr/bin/env bash

# Install GlobalsDB, Node.js and EWD.js on Centos 6.5 System
#  Assumes you've logged in as root
#  To get hold of and run this installer:
#    cd /opt
#    yum install -y subversion
#    svn export https://github.com/robtweed/ewd.js/trunk/globalsdb globalsdb
#    source globalsdb/install-centos-root.sh

# Update first just to be sure

yum update
yum install -y wget gzip openssh-server curl

# Install GlobalsDB

# First increase shared memory quotas

sysctl -w kernel.shmall=536870912
sysctl -w kernel.shmmax=536870912
echo 'kernel.shmall=536870912' >> /etc/sysctl.conf
echo 'kernel.shmmax=536870912' >> /etc/sysctl.conf

cd /opt
wget http://globalsdb.org/sites/default/files/globals_2013.2.0.350.0_unix.tar.gz

gzip -cd globals_2013.2.0.350.0_unix.tar.gz | tar -x
rm globals_2013.2.0.350.0_unix.tar.gz
cd kit_unix_globals
mkdir /opt/globalsdb
ISC_QUIET=yes
export ISC_QUIET
ISC_TGTDIR=/opt/globalsdb
export ISC_TGTDIR
ISC_PLATFORM=lnxsusex64
export ISC_PLATFORM
./installGlobals

cd /opt
rm -rf kit_unix_globals

# Install NVM

curl https://raw.githubusercontent.com/creationix/nvm/v0.10.0/install.sh | sh
source ~/.nvm/nvm.sh
nvm alias default 0.10
nvm install 0.10
nvm use default
echo 'nvm use default' >> ~/.profile

# Now ready to install EWD.js and Nodem:

cd /opt
mkdir ewdjs
cd ewdjs
npm install ewdjs


# Now install/configure EWD.js

cd node_modules/ewdjs
node install silent /opt/ewdjs

# Move the Node.js interface file into the correct place

mv /opt/globalsdb/bin/cache0100.node /opt/ewdjs/node_modules/cache.node

cd /opt/ewdjs

# now ready to start EWD.js using:

# cd /opt/ewdjs
# node ewdStart-gtm gtm-config


 