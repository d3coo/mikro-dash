const path = require('path');
const appDir = __dirname;

module.exports = {
  apps: [
    {
      name: 'mikro-dash',
      script: path.join(appDir, 'build', 'index.js'),
      cwd: appDir,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Database path - absolute path to ensure consistency
        DATABASE_PATH: path.join(appDir, 'data.db')
      },
      // Restart on crash
      autorestart: true,
      // Watch for changes (disable in production)
      watch: false,
      // Max memory before restart
      max_memory_restart: '500M',
      // Logging - use absolute paths
      error_file: path.join(appDir, 'logs', 'error.log'),
      out_file: path.join(appDir, 'logs', 'out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Merge logs
      merge_logs: true
    }
  ]
};
