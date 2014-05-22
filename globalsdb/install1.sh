#!/usr/bin/env bash

# Install GlobalsDB, Node.js and EWD.js on Ubuntu System

# Update first just to be sure

sudo apt-get update
sudo apt-get install -y wget gzip openssh-server curl

# Install GlobalsDB

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

curl https://raw.githubusercontent.com/creationix/nvm/v0.7.0/install.sh | sh

# Now stop terminal process and restart, then run part 2 of installer: source globalsdb/install2.sh

 