const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const { toCamel, replaceReserved } = require('./utils/string');
const { getPath } = require('./cli');

(async () => {
  const startTime = Date.now();
  const apiPath = await getPath().catch(() => null);

  if (!apiPath) {
    throw new Error('Incorrect URL');
  }

  const options = {
    hostname: 'documenter.gw.postman.com',
    port: 443,
    path: apiPath,
    method: 'GET',
  };

  const req = https.request(options, res => {
    console.log('⌛ Fetching data from server...');
    let data = '';

    res.on('data', chunk => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`✨  Data loaded!`);
      const d = JSON.parse(data);
      console.log('⌛ Handling data...');
      try {
        handleData(d);
        addApiManagerTemplate();
        console.log('✨  API template generated!');
        console.log('⌛ Formatting...');
        exec('npx prettier --write "./**/api/**/*.js"');
        const timestamp = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✨  Done in ${timestamp}s!`);
      } catch (error) {
        console.error(error);
      }
    });
  });

  req.end();

  function getServicesStructure() {
    return fs
      .readdirSync(path.join(__dirname, './api/services'))
      .filter(s => !/\.(js)$/.test(s));
  }

  function addServicesFile(services) {
    let importsRow = '';
    let exportsInner = '';

    for (let idx = 0; idx < services.length; idx++) {
      const service = services[idx];

      importsRow += `import {${service}} from './${service}';`;
      exportsInner += `${service},`;
    }

    const exportsRow = `export {${exportsInner}};`;
    const fileContent = `${importsRow}\n\n${exportsRow}\n`;

    fs.writeFileSync(
      path.join(__dirname, './api/services/index.js'),
      fileContent,
    );
  }

  function addApiManagerTemplate() {
    const sources = require('./data/sources.json');
    const services = getServicesStructure();
    addServicesFile(services);

    let servicesFields = '';
    let servicesGetters = '';

    for (let idx = 0; idx < services.length; idx++) {
      const service = services[idx];
      const innerServiceName = `#${service}Service`;
      servicesFields += `${innerServiceName} = this.proxyService(services.${service}());`;
      servicesGetters += `/**\n* @returns {ReturnType<services.${service}>}\n*/\nget ${service} () { return this.${innerServiceName} }`;
    }

    Object.entries(sources).forEach(([name, content]) => {
      if (name === 'ApiManager') {
        content = content.replace('{servicesFields}', servicesFields);
        content = content.replace('{servicesGetters}', servicesGetters);
      }
      fs.writeFileSync(path.join(__dirname, `./api/${name}.js`), content);
    });
  }

  function convertToObject(data) {
    if (data.item) {
      return data.item.reduce((acc, val) => {
        acc[replaceReserved(toCamel(val.name))] = convertToObject(val);
        return acc;
      }, {});
    }
    if (data.request) {
      const { method: httpMethod, urlObject, body } = data.request;

      if (httpMethod && urlObject && urlObject.path && urlObject.path.length) {
        const method = httpMethod.toLowerCase();
        const endpoint = urlObject.path.join('/');
        const innerRow = `const endpoint = '${endpoint}'; const response = await axios.${method}(\`\${apiPath}/\${endpoint}\`, {{body}}); return response.data;`;

        let resultRow = `{fnName}: async () => {${innerRow.replace(
          '{body}',
          '',
        )}}\n`;

        if (body?.formdata) {
          const sortedFormData = [...body.formdata].sort(
            (a, b) =>
              Number(/required/.test(b.description)) -
              Number(/required/.test(a.description)),
          );

          const exceptions = [];
          const arrRegex = /\[(.*)\]/g;
          let docRow = '';
          let argsRow = '';
          let fnArgsRow = '';

          for (let idx = 0; idx < sortedFormData.length; idx++) {
            let { key, description } = sortedFormData[idx];
            if (exceptions.some(v => v.includes(key))) return;

            if (arrRegex.test(key)) {
              key = key.replace(arrRegex, '');
              if (exceptions.includes(key)) continue;
              exceptions.push(key);
              description = `${
                /required/.test(description) ? 'required' : ''
              } in:`;
            }

            argsRow += `${key},`;
            fnArgsRow += `${key} ${
              /required/.test(description) ? '' : ' = null'
            },`;

            if (/\W(int|float)\W/.test(description)) {
              docRow += `\n* @param {number} ${key}`;
            } else if (/\Wstring\W/.test(description)) {
              docRow += `\n* @param {string} ${key}`;
            } else if (/\Win:\W/.test(description)) {
              docRow += `\n* @param {any[]} ${key}`;
            } else {
              docRow += `\n* @param {any} ${key}`;
            }

            if (idx === 0) {
              docRow = docRow.replace(/\n/, '');
            }
          }

          const doc = `/**\n${docRow}\n*/\n`;
          resultRow = `${doc} '{fnName}': async (${fnArgsRow}) => {${innerRow.replace(
            '{body}',
            argsRow,
          )}}\n`;
        } else if (urlObject.query && urlObject.query.length) {
          const params = urlObject.query;

          let docRow = '';
          let argsRow = '';
          let fnArgsRow = '';

          for (let idx = 0; idx < params.length; idx++) {
            const { key } = params[idx];
            docRow += `\n* @param {any} ${key}`;
            argsRow += `${key},`;
            fnArgsRow += `${key} = null,`;

            if (idx === 0) {
              docRow = docRow.replace(/\n/, '');
            }
          }

          const doc = `/**\n${docRow}\n*/\n`;
          resultRow = `${doc} '{fnName}': async (${fnArgsRow}) => {${innerRow.replace(
            '{body}',
            `params: {${argsRow}}`,
          )}}\n`;
        }

        return resultRow;
      }
    }
  }

  function handleData(rawData) {
    const data = convertToObject(rawData);
    const isApiExists = fs.readdirSync(__dirname).find(name => name === 'api');
    if (isApiExists) {
      fs.rmSync(path.join(__dirname, './api'), { recursive: true });
    }
    fs.mkdirSync(path.join(__dirname, `./api`));
    const isServicesExists = fs
      .readdirSync(path.join(__dirname, './api'))
      .find(name => name === 'services');
    if (!isServicesExists) {
      fs.mkdirSync(path.join(__dirname, `./api/services`));
    }

    createSources(data, path.join(__dirname, `./api/services`));
    return data;
  }

  /**
   * @param {string | Object} data
   * @param {string} _pathName
   */
  function createSources(_data, _pathName = __dirname) {
    const data = JSON.parse(JSON.stringify(_data));

    const wrapIntoExport = (key, row) =>
      `export const ${key} = (apiPath = '') => ({\n${row}\n});\n`;

    const writeFile = (key, value, pathName) => {
      let exportBody = '';

      if (typeof value === 'object') {
        exportBody = Object.entries(value).reduce(
          (result, [fnName, fnBody]) => {
            if (typeof fnBody === 'string') {
              result += fnBody.replace('{fnName}', fnName) + ',\n';
            } else if (typeof fnBody === 'object') {
              const newPath = path.join(pathName, fnName);
              fs.mkdirSync(newPath);
              writeFile(fnName, fnBody, newPath);
            }
            return result;
          },
          '',
        );
      } else if (typeof value === 'string') {
        exportBody = value;
      }

      fs.writeFileSync(`${pathName}/index.js`, wrapIntoExport(key, exportBody));
    };

    const entries = Object.entries(data);

    entries.forEach(([key, value]) => {
      const pathName = path.join(_pathName, key);
      fs.mkdirSync(pathName);
      if (typeof value === 'object') {
        writeFile(key, value, pathName);
        delete data[key];
      }
    });

    const restEntries = Object.entries(data);
    if (restEntries.length) {
      restEntries.forEach(([key]) => {
        fs.rmdirSync(path.join(_pathName, key));
      });
      writeFile('rootRequests', { rootRequests: { ...data } }, _pathName);
    }
  }
})();
