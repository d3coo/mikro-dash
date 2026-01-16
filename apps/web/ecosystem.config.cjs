module.exports = {
  apps: [{
    name: 'mikro-dash',
    script: 'build/index.js',
    cwd: 'C:/Users/shark/Documents/GitHub/mikro-dash/apps/web',
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000
    }
  }]
};
