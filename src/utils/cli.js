const rl = require('readline');

const getReadline = () => {
  return rl.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};

export const askQuestion = async question => {
  const readline = getReadline();
  const result = await new Promise(resolve =>
    readline.question(question, result => {
      resolve(result);
      readline.close();
    }),
  );
  return result;
};

export const getPath = async () => {
  const readline = getReadline();
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
