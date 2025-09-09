'use strict';

const mail = require('@sendgrid/mail');
const plunet = require('@scrptwr/plunet');
const { createMollieClient } = require('@mollie/api-client');

mail.setApiKey(process.env['SENDGRID_API_KEY']);

const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_KEY });

exports.handler = async function(event) {
  try {
    validateRequest(event);

    const quoteId = Number(event.queryStringParameters.quote);
    const paymentId = event.body.id;

    const quote = await getQuote(quoteId);

    await checkPayment(paymentId);

    await informCustomer(quote, event.queryStringParameters.locale);

    await setQuoteStatus(quote);

    return { statusCode: 200 };
  } catch (error) {
    return errorHandler(error);
  }
}

async function informCustomer(quote, locale) {
  if (quote.customer.email || quote.contact.email) {
    await mail.send({
      to: quote.contact.email ? quote.contact.email : quote.customer.email,
      from: 'Scriptware Translations <noreply@scriptware.nl>',
      templateId: locale === 'nl-nl' ? 'd-e33f75f584114fac8607ff51da751e5a' : 'd-9678bc7d01c64b69bfe60d53ce92c4f0',
      dynamicTemplateData: {
        quote: quote.quoteNumber
      }
    })
  }
}

async function setQuoteStatus(quote) {
  const response = await plunet.setQuoteStatus({ id: quote.id, status: 'Accepted' });

  if (response.statusCode !== 0) {
    await sendMail(quote.quoteNumber, 'Status van offerte niet gewijzigd', `Ondanks dat de betaling gelukt is kon de status van offerte <b>${quote.quoteNumber}</b> niet worden gewijzigd naar <i>Geaccepteerd</i>. Waarschijnlijk omdat iemand de offerte open heeft staan. S.v.p. de status handmatig wijzigen naar <i>Geaccepteerd</i>.`);
  } else {
    await sendMail(quote.quoteNumber, 'Offerte betaald', `Offerte <b>${quote.quoteNumber}</b> is succesvol betaald en dus geaccepteerd door de klant. De status van de offerte is gewijzigd naar <i>Geaccepteerd</i>.`);
  }
}

async function checkPayment(id) {
  let payment;

  try {
    payment = await mollieClient.payments.get(id);
  } catch (error) {
    throw 'PAYMENT_ID_DOES_NOT_EXISTS';
  }

  if (payment.status !== 'paid') throw 'PAYMENT_NOT_PAID';
}

async function getQuote(quoteId) {
  const response = await plunet.getQuoteById({ quoteId });

  if (response.statusCode !== 0) {
    throw 'QUOTE_DOES_NOT_EXISTS';
  }

  const responseGetQuoteContact = await plunet.getQuoteContact({ quoteId });

  response.data.contact = {};

  if (responseGetQuoteContact.statusCode !== 0) {
    response.data.contact.id = undefined;
  } else {
    response.data.contact.id = responseGetQuoteContact.data;
  }

  if (response.data.contact.id) {
    const responseGetContact = await plunet.getContact({ contactId: response.data.contact.id });

    if (responseGetContact.statusCode === 0) {
      response.data.contact = { ...response.data.contact, ...responseGetContact.data };
    }
  }

  const responseGetQuoteCustomer = await plunet.getQuoteCustomer({ quoteId });

  response.data.customer = {};

  if (responseGetQuoteCustomer.statusCode !== 0) {
    response.data.customer.id = undefined;
  } else {
    response.data.customer.id = responseGetQuoteCustomer.data;
  }

  if (response.data.customer.id) {
    const responseGetCustomer = await plunet.getCustomer({ customerId: response.data.customer.id });

    if (responseGetCustomer.statusCode === 0) {
      response.data.customer = { ...response.data.customer, ...responseGetCustomer.data };
    }
  }

  return response.data;
}

function validateRequest(event) {
  const { httpMethod, queryStringParameters, headers } = event;

  if (httpMethod !== 'POST') {
    throw new ErrorResponse(405, 'METHOD_NOT_ALLOWED', 'HTTP request method POST expected');
  }

  const {quote} = queryStringParameters;

  if (!quote) {
    throw new ErrorResponse(400, 'NO_QUOTE_PARAMETER', 'URL parameter \'quote\' expected');
  }

  if (!/^[0-9]{4,5}$/.test(quote)) {
    throw new ErrorResponse(400, 'INVALID_QUOTE_PARAMETER', 'Invalid URL parameter \'quote\'');
  }

  if (headers['content-type'] !== 'application/x-www-form-urlencoded') {
    throw new ErrorResponse(400, 'INVALID_CONTENT_TYPE', 'Body Content-Type \'application/x-www-form-urlencoded\' expected');
  }

  event.body = bodyParser(event.body);
  
  if (!event.body.id) {
    throw new ErrorResponse(400, 'NO_ID', 'Body parameter \'id\' expected');
  }
}

function bodyParser(body) {
  return body
           .split('&')
           .reduce((items, item) => {
             item = item.split('=');

             items[item[0]] = item[1];

             return items;
           }, {})
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
      subject: `Offerte ${quote} is betaald`,
      title: title,
      paragraphs: [message]
    }
  })
}