#!/usr/bin/env bash

# Update first just to be sure

sudo apt-get update

# Install GT.M

sudo apt-get install -y fis-gtm

# Create standard default database setup

echo -e 'H\n' | /usr/lib/fis-gtm/V6.0-003_x86_64/gtm -direct

# Install NVM (Node.js Version Manager)

sudo apt-get install -y curl
curl https://raw.githubusercontent.com/creationix/nvm/v0.7.0/install.sh | sh

# Now stop terminal process and restart, then run part 2 of installer



