module.exports = {
  apps: [
    {
      name: 'mikro-dash',
      script: 'build/index.js',
      cwd: 'C:/Users/shark/Documents/GitHub/mikro-dash/apps/web',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
