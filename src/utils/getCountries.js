import countries from './countries.json';

function getCountries(language) {
  const items = [];

  for (const key in countries) {
    if (language === 'en-gb') {
      items.push({ value: key, text: key });
    } else {
      items.push({ value: key, text: countries[key][language] });
    }
  }

  const sortedItems = items.sort((a, b) => {
    const textA = a.text.toUpperCase();
    const textB = b.text.toUpperCase();
    
    if (textA < textB) {
      return -1;
    }
    if (textA > textB) {
      return 1;
    }

    return 0;
  });

  return sortedItems;
}

export default getCountries;