var term = require('ewdvistaterm');

term.start({
  log: true,
  spawnVistA: {
    command: 'sshpass', 
    arguments: ['-p', 'tied', 'ssh', '-o', 'StrictHostKeyChecking=no', 'osehratied@localhost', '-tt']
  },
  webServer: {
    port: 8081,
    rootPath: '/home/osehra/www',
    ssl: true,  
    options: {
      key: '/home/osehra/ssl/ssl.key',
      cert: '/home/osehra/ssl/ssl.crt'
    }
  },
  addLF: false,
  echo: true,
  exitString: 'Logged out at '
});