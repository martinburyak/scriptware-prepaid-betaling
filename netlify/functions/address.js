'use strict';

const mail = require('@sendgrid/mail');
const plunet = require('@scrptwr/plunet');

mail.setApiKey(process.env['SENDGRID_API_KEY']);

exports.handler = async event => {
  try {
    validateRequest(event);

    const quoteNumber = event.body.quote;
    const quote = await getQuote(quoteNumber);
    const customerId = await getCustomerId(quote.id, quoteNumber);
    const customer = await getCustomer(customerId);
    let addressId = await getAddressId(customerId, quoteNumber);

    const customerType = customer.formOfAddress === 'Company' ? 'commercial' : 'private';

    if (!addressId) addressId = await addAddress(customerId);

    const preselectedTax = countries()[event.body.country][customerType];
    const salesTaxId = event.body.salesTaxId || undefined

    await setPaymentInformation(customerId, preselectedTax, salesTaxId, quoteNumber);

    await setAddress(addressId, event.body.street, event.body.zipCode, event.body.city, event.body.country, quoteNumber);

    return { statusCode: 200 };  
  } catch (error) {
    return errorHandler(error);
  } 
}

async function addAddress(customerId) {
  const response = await plunet.addCustomerAddress({
    customerId,
    country: 'The Netherlands',
    type: 'Invoice'
  });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Kan geen nieuw adres maken', `Zorg ervoor dat niemand het record van de bijbehorende klant in Plunet open heeft staan.`);

    throw 'NOT_CREATE_ADDRESS';
  }

  return response.data;
}

async function setAddress(id, street, zipcode, city, country, quoteNumber) {
  const type = 'Invoice';

  const response = await plunet.updateCustomerAddress({ id, type, street, zipcode, city, country });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Kan adres niet wegschrijven', `Zorg ervoor dat niemand het record van de bijbehorende klant in Plunet open heeft staan.`);

    throw 'NOT_UPDATE_ADDRESS';
  }
}

async function setPaymentInformation(customerId, preselectedTax, salesTaxId, quoteNumber) {
  const response = await plunet.setCustomerPaymentInformation({ paymentMethod: 'Bank transfer', customerId, preselectedTax, salesTaxId });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Kan Payment Information niet wegschrijven', `Zorg ervoor dat niemand het record van de bijbehorende klant in Plunet open heeft staan.`);

    throw 'NO_UPDATE_PAYMENT';
  }
}

async function getAddressId(customerId, quoteNumber) {
  const response = await plunet.getCustomerAllAddresses({ customerId });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Probleem met address ids', `Er heeft zich een fout voorgedaan bij het ophalen van de address ids.`);

    throw 'NO_ADDRESS_IDS';
  }

  return response.data[1];
}

async function getCustomer(customerId) {
  const response = await plunet.getCustomer({ customerId });

  const customer = response.statusCode === 0;

  if (!customer) {
    await sendMail(quoteNumber, 'Geen klant gekoppeld', `Er is geen klant gekoppeld aan offerte <b>${quoteNumber}</b>. Om de offerte te kunnen betalen moet er een klant geselecteerd zijn.`);

    throw 'NO_QUOTE_CUSTOMER';
  }

  return response.data;
}

async function getCustomerId(quoteId, quoteNumber) {
  const response = await plunet.getQuoteCustomer({ quoteId });

  const customer = response.statusCode === 0;

  if (!customer) {
    await sendMail(quoteNumber, 'Geen klant gekoppeld', `Er is geen klant gekoppeld aan offerte <b>${quoteNumber}</b>. Om de offerte te kunnen betalen moet er een klant geselecteerd zijn.`);

    throw 'NO_QUOTE_CUSTOMER';
  }

  return response.data;
}

async function getQuote(quoteNumber) {
  const response = await plunet.getQuoteByNumber({ quoteNumber });

  const quoteExists = response.statusCode === 0;

  if (!quoteExists) {
    throw new ErrorResponse(400, 'QUOTE_NOT_EXIST', 'Quote does not exist.');
  }

  const pending = response.data.status === 'Pending' || response.data.status === 'Rejected';

  if (!pending) {
    const dutchStatus = {
      'New (auto)': 'Nieuw (auto)',
      'In preparation': 'In voorbereiding',
      'Review before submission': 'Controle vrijgave',
      'Pending': 'Openstaand',
      'Expired': 'Verlopen',
      'Revised': 'Herzien',
      'Rejected': 'Afgewezen',
      'Accepted': 'Geaccepteerd',
      'Changed into order': 'In opdracht omgezet',
      'Canceled': 'Geannuleerd'
    }

    await sendMail(quoteNumber, `Offerte bevat verkeerde status`, `De status van offerte <b>${quoteNumber}</b> staat op <i>${response.data.status}</i>. Om de offerte te kunnen betalen moet de status op <i>Pending</i> of <i>Rejected</i> staan.`);

    if (response.data.status === 'Expired') {
      throw new ErrorResponse(400, 'QUOTE_EXPIRED', 'Quote is expired.');
    }
    
    if (response.data.status === 'Accepted') {
      throw new ErrorResponse(400, 'QUOTE_ACCEPTED', 'Quote is expired.');
    }

    if (response.data.status === 'Changed into order') {
      throw new ErrorResponse(400, 'QUOTE_CHANGED_INTO_ORDER', 'Quote is changed into order.');
    }

    throw 'QUOTE_NOT_PENDING';
  }

  return response.data;
}

function validateRequest(event) {
  if (event.httpMethod !== 'POST') {
    throw new ErrorResponse(405, 'METHOD_NOT_ALLOWED', 'HTTP request method POST expected');
  }

  if (!(event.headers['content-type'] && event.headers['content-type'] === 'application/json')) {
    throw new ErrorResponse(415, 'JSON_BODY_EXPECTED', 'JSON body expected.');
  }

  try {
    event.body = JSON.parse(event.body);
  } catch (error) {
    throw new ErrorResponse(415, 'JSON_BODY_EXPECTED', 'JSON body expected.');
  }

  if (!event.body.quote) {
    throw new ErrorResponse(400, 'QUOTE_PARAMETER_EXPECTED', 'Body parameter \'quote\' expected.');
  }

  if (!/Q-[0-9]{5}-[0-9]{2}/.test(event.body.quote)) {
    throw new ErrorResponse(400, 'INVALID_QUOTE_PARAMETER', 'Invalid quote parameter.');
  }

  if (!event.body.street) {
    throw new ErrorResponse(400, 'STREET_PARAMETER_EXPECTED', 'Body parameter \'street\' expected.');
  }

  if (!event.body.zipCode) {
    throw new ErrorResponse(400, 'ZIPCODE_PARAMETER_EXPECTED', 'Body parameter \'zipCode\' expected.');
  }

  if (!event.body.city) {
    throw new ErrorResponse(400, 'CITY_PARAMETER_EXPECTED', 'Body parameter \'city\' expected.');
  }

  if (!event.body.country) {
    throw new ErrorResponse(400, 'COUNTRY_PARAMETER_EXPECTED', 'Body parameter \'country\' expected.');
  }

  if (!Object.keys(countries()).includes(event.body.country)) {
    throw new ErrorResponse(400, 'INVALID_COUNTRY_PARAMETER', 'Invalid country.');
  }
}

function errorHandler(error) {
  const ErrorResponse = error.name === 'ErrorResponse';

  if (ErrorResponse) {
    return error.response;
  } else {
    console.log(error);
    return { statusCode: 500 };
  }
}

class ErrorResponse extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ErrorResponse';

    console.log(code);

    const body = JSON.stringify({ error: { code, message } });

    this.response = { statusCode, body }
  }
}

async function sendMail(quote, title, message) {
  await mail.send({
    to: process.env['ERROR_EMAIL'],
    from: 'Website <noreply@scriptware.nl>',
    templateId: 'd-7cc23d30b3734bf5908a465b937ef93d',
    dynamicTemplateData: {
      subject: `Betaling mislukt van offerte ${quote}`,
      title: title,
      paragraphs: [message]
    }
  })
}

function countries() {
  return {
    'Afghanistan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Albania': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Algeria': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Andorra': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Angola': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Antigua and Barbuda': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Argentina': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Armenia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Aruba': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Australia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Austria': 'Tax 2',
    'Azerbaijan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bahamas': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bahrain': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bangladesh': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Barbados': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Belarus': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Belgium': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Belize': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Benin': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bhutan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bolivia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bosnia and Herzegovina': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Botswana': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Brazil': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Brunei Darussalam': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Bulgaria': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Burkina Faso': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Burundi': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Cambodia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Cameroon': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Canada': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Cape Verde': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Central African Republic': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Chad': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Chile': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'China': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Colombia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Congo': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Cook Islands': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Costa Rica': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Côte d\'Ivoire': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Croatia': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Cuba': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Curaçao': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Cyprus': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Czech Republic': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Denmark': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Djibouti': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Dominica': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Dominican Republic': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'East Timor': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Ecuador': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Egypt': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'El Salvador': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Equatorial Guinea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Eritrea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Estonia': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Ethiopia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Fiji': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Finland': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'France': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Gabon': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Gambia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Georgia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Germany': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Ghana': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Greece': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Grenada': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Guatemala': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Guinea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Guinea-Bissau': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Guyana': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Haiti': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Honduras': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Hongkong': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Hungary': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Iceland': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'India': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Indonesia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Iran': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Iraq': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Ireland': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Israel': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Italy': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Jamaica': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Japan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Jordan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Qatar': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Kazachstan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Kenya': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Korea, Republic': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Kosovo': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Kuwait': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Kyrgyzstan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Laos': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Latvia': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Lebanon': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Lesotho': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Liberia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Libya': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Liechtenstein': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Lithuania': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Luxembourg': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Macedonia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Madagascar': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Malawi': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Malaysia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Maldives': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mali': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Malta': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Marshall Islands': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mauritania': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mauritius': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mexico': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Moldova': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Monaco': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mongolia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Morocco': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Mozambique': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Myanmar': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Namibia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Nauru': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Nepal': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'The Netherlands': { 'commercial': 'Tax 1', 'private': 'Tax 1' },
    'New Zealand': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Nicaragua': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Niger': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Nigeria': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Niue': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'North Korea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Norway': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Oman': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Pakistan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Palau': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Panama': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Papua New Guinea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Paraguay': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Peru': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Philippines': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Poland': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Portugal': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Romania': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Russia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Rwanda': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Samoa': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'San Marino': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Saudi Arabia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Senegal': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Serbia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Seychelles': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Sierra Leone': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Singapore': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Slovakia': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Slovenia': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Solomon Islands': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Somalia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'South Africa': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'South Korea': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Spain': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Sri Lanka': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'St Maarten': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Sudan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Suriname': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Swaziland': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Sweden': { 'commercial': 'Tax 2', 'private': 'Tax 1' },
    'Switzerland': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Syria': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Taiwan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Tajikistan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Tanzania': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Thailand': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Togo': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Tonga': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Trinidad and Tobago': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Tunisia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Turkey': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Turkmenistan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Tuvalu': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Uganda': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Ukraine': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'United Arabian Emirates': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'United Kingdom': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'United States': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Uruguay': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Uzbekistan': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Vatican City State': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Venezuela': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Vietnam': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Yemen': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Yugoslavia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Zambia': { 'commercial': 'Tax 3', 'private': 'Tax 3' },
    'Zimbabwe': { 'commercial': 'Tax 3', 'private': 'Tax 3' }
  }
}