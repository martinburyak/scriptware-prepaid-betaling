import React, { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import QuoteNumber from '../../../components/QuoteNumber';
import Alert from '../../../components/Alert';
import CompanyName from '../../../components/CompanyName';
import Address from '../../../components/Address';
import Disclaimer from '../../../components/Disclaimer';
import getText from '../../../utils/getText';

function Quote({params}) {
  const [addressSaved, setAddressSaved] = useState();
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState();
  const [quoteNumber, setQuoteNumber] = useState();
  const [showAddress, setShowAddress] = useState();
  const [company, setCompany] = useState(false);

  useEffect(() => {(async () => {
    setLoading(true);

    const validLanguage = ['nl-nl', 'en-gb'].includes(params.language);
    const validQuote = /Q-[0-9]{5}-[0-9]{2}/.test(params.quote);

    if (!validLanguage) {
      setAlert('Invalid language code');
      setLoading(false);
    } else if (!validQuote) {
      setAlert(getText('Invalid quote number', params.language));
      setLoading(false);
    } else {
      setQuoteNumber(params.quote);

      const paymentLink = await getPaymentLink(params.quote, params.language);

      if (paymentLink.error && paymentLink.error.includes('UNKNOWN_COUNTRY')) {
        if (paymentLink.error === 'UNKNOWN_COUNTRY_COMPANY') setCompany(true);
        setShowAddress(true);
        setLoading(false);
      }

      if (paymentLink.error && !paymentLink.error.includes('UNKNOWN_COUNTRY')) {
        setAlert(getText(paymentLink.error, params.language));
        setLoading(false);
      }

      if (!paymentLink.error) {
        window.location.href = paymentLink;
      }
    }
  })()}, [params.language, params.quote, addressSaved])

  
  async function postAddress(street, zipCode, city, country, salesTaxId) {
    setLoading(true);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quote: params.quote,
        street,
        zipCode,
        city,
        country,
        salesTaxId
      })
    };

    const response = await fetch(`/.netlify/functions/address`, options);

    if (response.status !== 200) {
      setAlert('Something went wrong, please try again later.');
      setShowAddress(false);
      setLoading(false);
    } else {
      setAddressSaved(true);
    }
  }

  return (
    <Layout loading={loading}>
      <QuoteNumber value={quoteNumber} />
      <CompanyName />
      <Alert value={alert} />
      
      <Address
        visible={showAddress}
        language={params.language}
        company={company}
        onChange={postAddress}
      />

      <Disclaimer language={params.language} />
    </Layout>
  )
}

export default Quote;

async function getPaymentLink(quoteNumber, language) {
  language = language.replace(/([a-z]{2})-([a-z]{2})/, (match, first, second) => `${first}_${second.toUpperCase()}`);

  const response = await fetch(`/.netlify/functions/link?quote=${quoteNumber}&locale=${language}`);

  if (response.status === 500) {
    return { error: 'Something went wrong, please try again later.' }
  }

  const body = await response.json();

  if (response.status === 400 && body.error.code.includes('UNKNOWN_COUNTRY')) {
    return { error: body.error.code }
  }

  if (response.status === 400 && !body.error.code.includes('UNKNOWN_COUNTRY')) {
    return { error: body.error.message }
  }

  return body.url;
}