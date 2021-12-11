const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

const getPath = async () => {
  const link = await new Promise(resolve =>
    readline.question(`Put your postman documentation link: `, name => {
      resolve(name);
      readline.close();
    }),
  );
  const url = new URL(link);
  return `/api/collections/${url.pathname
    .split('/')
    .slice(-2)
    .join('/')}?segregateAuth=true&versionTag=latest`;
};

module.exports = {
  getPath,
};
