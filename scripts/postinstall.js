const path = require('path');
const fs = require('fs');

(() => {
  const argRegExp = /^--/;
  process.argv
    .filter(a => argRegExp.test(a))
    .forEach(arg => {
      const [key, value] = arg.replace(argRegExp, '').split('=');
      switch (key) {
        case 'initdir': {
          const packageJson = require(path.join(value, './package.json'));

          packageJson.scripts.getApi =
            'node ./getApiTemplate.js --outdir=./src/api';
          fs.writeFileSync(
            path.join(value, './package.json'),
            JSON.stringify(packageJson, undefined, 2),
            { encoding: 'utf8' },
          );
          fs.copyFileSync(
            path.join(__dirname, '../dist/getApiTemplate.js'),
            path.join(value, 'getApiTemplate.js'),
          );
          break;
        }
      }
    });
})();
