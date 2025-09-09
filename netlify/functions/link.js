'use strict';

const mail = require('@sendgrid/mail');
const plunet = require('@scrptwr/plunet');
const { createMollieClient } = require('@mollie/api-client');

mail.setApiKey(process.env['SENDGRID_API_KEY']);

exports.handler = async function(event) {
  try {
    validateRequest(event);

    const quoteNumber = event.queryStringParameters.quote;

    const quote = await getQuote(quoteNumber);
    const customerId = await getCustomerId(quote.id, quoteNumber);
    const addressId = await getAddressId(customerId, quoteNumber);

    const [country, preselectedTax, city] = await Promise.all([
      await getCountry(addressId),
      await getPreselectedTax(customerId),
      await getCity(addressId)
    ]);

    const price = await getPrice(quote.id, preselectedTax, quoteNumber);

    if (city) {
      const methods = ['creditcard', 'paypal'];

      if (country === 'The Netherlands') methods.push('ideal');
      if (country === 'Belgium') methods.push('bancontact');

      try {
        const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_KEY });

        const payment = await mollieClient.payments.create({
          amount: {
            value: price,
            currency: 'EUR'
          },
          description: quote.number,
          redirectUrl: `https://payment.scriptwaretranslations.com/${event.queryStringParameters.locale.replace(/([a-z]{2})_([A-Z]{2})/, (match, first, second) => `${first}-${second.toLowerCase()}`)}/${event.queryStringParameters.quote}/ok`,
          webhookUrl: `https://payment.scriptwaretranslations.com/.netlify/functions/status/?quote=${quote.id}&locale=${event.queryStringParameters.locale.replace(/([a-z]{2})_([A-Z]{2})/, (match, first, second) => `${first}-${second.toLowerCase()}`)}`,
          locale: event.queryStringParameters.locale,
          method: methods
        });

        return {
          statusCode: 200,
          body: JSON.stringify({url: payment.getCheckoutUrl()})
        }
      } catch (error) {
        await sendMail(quoteNumber, `Betaallink mislukt`, `Het genereren van een Mollie betaallink is mislukt.`);

        throw error;
      }
    } 

    if (!city) {
      const formOfAddress = await getFormOfAddress(customerId, quoteNumber) || '';

      throw new ErrorResponse(400, `UNKNOWN_COUNTRY_${formOfAddress.toUpperCase()}`, 'Customer country unknown');
    }

    return { statusCode: 200 };
  } catch (error) {
    return errorHandler(error);
  }
}

async function getPrice(projectId, preselectedTax, quoteNumber) {
  const response = await plunet.getItems({ projectId, projectType: 'Quote' });

  const items = response.data.length > 0;

  if (!items) {
    await sendMail(quoteNumber, 'Offerte zonder items', `Offerte <b>${quoteNumber}</b> bevat geen items. Een offerte moet minstens 1 item bevatten om een prijs te kunnen bepalen.`)

    throw 'QUOTE_WITHOUT_ITEMS';
  }

  let price = response.data.reduce((total, item) => total + item.totalPrice, 0);

  if (preselectedTax === 'Tax 1') price = price * 1.21;

  price = (parseFloat(price).toFixed(2));

  return price;  
}

async function getFormOfAddress(customerId, quoteNumber) {
  const response = await plunet.getCustomer({ customerId });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Probleem met Form of address', 'Er heeft zich een fout voorgedaan bij het ophalen van de Form of address.');

    throw 'FORM_OF_ADDRESS';
  }

  return response.data.formOfAddress;
}

async function getCountry(addressId) {
  if (!addressId) return undefined;

  const response = await plunet.getCustomerAddressCountry({ addressId });

  return response.data || undefined;
}

async function getCity(addressId) {
  if (!addressId) return undefined;

  const response = await plunet.getCustomerAddressCity({ addressId });

  return response.data || undefined;
}

async function getPreselectedTax(customerId) {
  const response = await plunet.getCustomerPaymentInformation({ customerId });

  return response.data.preselectedTax || '';
}

async function getAddressId(customerId, quoteNumber) {
  const response = await plunet.getCustomerAllAddresses({ customerId });

  if (response.statusCode !== 0) {
    await sendMail(quoteNumber, 'Probleem met address ids', 'Er heeft zich een fout voorgedaan bij het ophalen van de address ids.');

    throw 'NO_ADDRESS_IDS';
  }

  return response.data[1];
}

async function getCustomerId(quoteId, quoteNumber) {
  const response = await plunet.getQuoteCustomer({ quoteId });

  if (response.statusCode !== 0) {
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
    await sendMail(quoteNumber, `Offerte bevat verkeerde status`, `De status van offerte <b>${quoteNumber}</b> staat op <i>${response.data.status}</i>. Om de offerte te kunnen betalen moet de status op <i>Pending</i> of <i>Rejected</i> staan.`);

    if (response.data.status === 'Expired') {
      throw new ErrorResponse(400, 'QUOTE_EXPIRED', 'The quote is expired.');
    }
    
    if (response.data.status === 'Accepted') {
      throw new ErrorResponse(400, 'QUOTE_ACCEPTED', 'The quote is already accepted.');
    }

    if (response.data.status === 'Changed into order') {
      throw new ErrorResponse(400, 'QUOTE_CHANGED_INTO_ORDER', 'The quote is already accepted.');
    }

    throw 'QUOTE_NOT_PENDING';
  }

  return response.data;
}

function validateRequest(event) {
  if (event.httpMethod !== 'GET') {
    throw new ErrorResponse(405, 'METHOD_NOT_ALLOWED', 'HTTP request method GET expected');
  }

  if (!event.queryStringParameters.locale) {
    throw new ErrorResponse(400, 'NO_LOCALE_PARAMETER', 'URL parameter \'locale\' expected');
  }

  if (!['nl_NL', 'en_GB'].includes(event.queryStringParameters.locale)) {
    throw new ErrorResponse(400, 'INVALID_LOCALE_PARAMETER', 'Invalid URL parameter \'locale\'');
  }

  if (!event.queryStringParameters.quote) {
    throw new ErrorResponse(400, 'NO_QUOTE_PARAMETER', 'URL parameter \'quote\' expected');
  }

  if (!/Q-[0-9]{5}-[0-9]{2}/.test(event.queryStringParameters.quote)) {
    throw new ErrorResponse(400, 'INVALID_QUOTE_PARAMETER', 'Invalid URL parameter \'quote\'');
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