const toCamel = str =>
  str
    .split(' ')
    .map(
      (s, i) =>
        s.charAt(0)[i === 0 ? 'toLowerCase' : 'toUpperCase']() + s.slice(1),
    )
    .join('');

const replaceReserved = str => {
  const reserved = [/\//g, /\\/g];
  return reserved.reduce((result, regexp) => {
    result = result.replace(regexp, '');
    return result;
  }, str);
};

module.exports = {
  toCamel,
  replaceReserved,
};
