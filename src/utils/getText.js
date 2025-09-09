import strings from './strings.json';

function getText(string, language) {
  return strings[string] && strings[string][language] ? strings[string][language] : string;
}

export default getText;