import React, { memo, useState, useEffect } from 'react';
import Layout from '../../../components/Layout';
import QuoteNumber from '../../../components/QuoteNumber';
import Title from '../../../components/Title';
import Text from '../../../components/Text';
import Disclaimer from '../../../components/Disclaimer';
import getText from '../../../utils/getText';

function Ok({ params }) {
  const [quoteNumber, setQuoteNumber] = useState();
  const [language, setLanguage] = useState();
  const [title, setTitle] = useState();
  const [text, setText] = useState();

  useEffect(() => {
    setQuoteNumber(params.quote);
    setLanguage(params.language);
    setTitle(getText('Your Payment was Successful!', params.language));
    setText(getText('We start working for you right away. Our project manager will keep you informed about the delivery of your translation.<br /><br />Thank you very much for your order.', params.language));
  }, [params.quote, params.language]);

  return (
    <Layout>
      <QuoteNumber value={quoteNumber} />
      <Title value={title} />
      <Text value={text} />
      <Disclaimer language={language} />
    </Layout>
  )
}

export default memo(Ok);