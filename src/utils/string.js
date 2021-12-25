export const toCamel = str =>
  str
    .split(' ')
    .map(
      (s, i) =>
        s.charAt(0)[i === 0 ? 'toLowerCase' : 'toUpperCase']() + s.slice(1),
    )
    .join('');

export const replaceReserved = str => {
  const reserved = [/\//g, /\\/g];
  return reserved.reduce((result, regexp) => {
    result = result.replace(regexp, '');
    return result;
  }, str);
};
