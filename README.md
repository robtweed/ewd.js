# EWD.js
 
Node.js-based Application Framework and Application Server/Container for use with Cach&#233;, GlobalsDB, GT.M and 
MongoDB databases

Rob Tweed <rtweed@mgateway.com>  
9 May 2014, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)

## Acknowledgements

Many thanks to:
   Christopher Edwards (christopher.edwards@krminc.com) for his work on Node Inspector
integration which has been adapted and included in EWD.js (build 67 and later).

   Ward De Backer for numerous functional additions

   Mike Clayton for the original design of the UpStart files, and for 
help identifying many bugs over the years!

   David Wicksell for his ongoing work on the NodeM interface for GT.M

## Installing EWD.js

Create a directory for your EWD.js environment, eg *~/ewdjs*

Then, assuming you've already installed Node.js:

       cd ~/ewdjs
       npm install ewdjs

Modify that first *cd* command as appropriate for your system.

During the installation process, you’ll be asked to confirm the path in which EWD.js has been installed (ie the
directory you'd switched to using *cd*).  You should normally accept the default that it suggests by 
pressing the Enter key, eg: 

       Install EWD.js to directory path (/home/ubuntu/ewdjs):

The essential sub-components of EWD.js will be installed relative to this path.
You’ll then be asked if you want to install the extra, optional sub-components for EWD.js:

  
       EWD.js has been installed and configured successfully
       
       Do you want to install the additional resources from the /extras directory?
       If you're new to EWD.js or want to create a test environment, enter Y
       If you're an experienced user or this is a production environment, enter N
       Enter Y/N: 


EWD.js is now ready for use!



## Running EWD.js
	
After you run the install file, you'll find a number of pre-built example startup files for the various
databases and operating systems on which the databases are supported.  For example, to start up EWD.js 
for use with the GT.M database (which runs on Linux):

      cd ~/ewdjs
      node ewdStart-gtm

Again, modify that first *cd* command as appropriate for your system.

You may need to edit the startup file to specify a different webServer port, external listener port,
child processes pool size, custom directories etc.

## Create a GT.M-based system from scratch

Instead of going through the steps above, EWD.js provides some install scripts that do all the work for you.
One of these sets of scripts will create a complete working system that includes the GT.M database, 
Node.js and EWD.js.  All you need is a new, empty Ubuntu 14.04 (or later) machine, virtual machine or
EC2 instance.

Start up the Ubuntu 14.04 machine.  Login and type:

       cd ~
       sudo apt-get -y install git
       git clone https://github.com/robtweed/ewd-installers
       source ewd-installers/gtm/install.sh

That's it!  You can test that everything has worked by typing:

      node test-gtm

If no errors appear, you should be good to go.  Start EWD.js by typing:

      node ewdStart-gtm gtm-config

Start the new, improved EWDMonitor application using the usual URL:

      http://xx.xx.xx.xx:8080/ewd/ewdMonitor/index.html

## Create a GlobalsDB-based system from scratch

It's equally as quick and easy to create an EWD.js system that uses GlobalsDB instead of GT.M. 
Once again, all you need is a new, empty Ubuntu machine, virtual machine or
EC2 instance.  For the GlobalsDB-based install scripts, you aren't restricted to Ubuntu 14.04 - any
version will do.

Start up the Ubuntu machine.  Login and type:

       cd ~
       sudo apt-get -y install git
       git clone https://github.com/robtweed/ewd-installers
       source ewd-installers/globalsdb/install.sh

That's it!  Start EWD.js by typing:

      node ewdStart-globals

Start the EWDMonitor application using the usual URL:

      http://xx.xx.xx.xx:8080/ewd/ewdMonitor/index.html

## Upgrade a dEWDrop Virtual Machine

You can automatically upgrade Node.js and NodeM and install EWD.js on a dEWDrop VM as follows:

       cd ~
       sudo apt-get -y install git
       git clone https://github.com/robtweed/ewd-installers
       source ewd-installers/dEWDrop/upgrade.sh

When finished, you can start up EWD.js using:

      node ewdStart-gtm dewdrop-config

Start the new, improved EWDMonitor application using the usual URL:

      http://xx.xx.xx.xx:8080/ewd/ewdMonitor/index.html


Move any existing applications to */home/vista/ewdjs/www*  and modules to */home/vista/ewdjs/node_modules*


##Documentation

For full information on EWD.js, how to install, configure and run it, and how to build EWD.js applications,  
see: [http://gradvs1.mgateway.com/download/EWDjs.pdf]
(http://gradvs1.mgateway.com/download/EWDjs.pdf)


## License

 Copyright (c) 2013-16 M/Gateway Developments Ltd,
 Reigate, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  http://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
