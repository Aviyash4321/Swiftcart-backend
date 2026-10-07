const packageJson = require('../package.json');

const appVersion = {
  name: packageJson.name,
  version: packageJson.version,
};

module.exports = appVersion;
