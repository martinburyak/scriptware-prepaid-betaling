import React, { memo, useEffect, useState, createRef } from 'react';
import * as styles from './style.module.scss';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import TextField from '../TextField';
import SelectField from '../SelectField';
import Button from '../Button';
import getText from '../../utils/getText';
import getCountries from '../../utils/getCountries';

function Address({visible, language, company, onChange}) {
  const form = createRef();

  const [street, setStreet] = useState();
  const [streetLabel, setStreetLabel] = useState();
  const [streetPlaceholder, setStreetPlaceholder] = useState();

  const [zipCode, setZipCode] = useState();
  const [zipCodeLabel, setZipCodeLabel] = useState();
  const [zipCodePlaceholder, setZipCodePlaceholder] = useState();

  const [city, setCity] = useState();
  const [cityLabel, setCityLabel] = useState();
  const [cityPlaceholder, setCityPlaceholder] = useState();

  const [country, setCountry] = useState();
  const [countryLabel, setCountryLabel] = useState();
  const [countryItems, setCountryItems] = useState();
  const [selectedCountry, setSelectedCountry] = useState();

  const [vatId, setVatId] = useState();
  const [vatIdLabel, setVatIdLabel] = useState();
  const [vatIdPlaceholder, setVatIdPlaceholder] = useState();
  const [showVatid, setShowVatid] = useState();

  const [buttonText, setButtonText] = useState();

  useEffect(() => {
    if (visible) {
      setStreetLabel(getText('Street name and house number', language));
      setStreetPlaceholder(getText('Main Street 12', language));

      setZipCodeLabel(getText('Zip Code', language));
      setZipCodePlaceholder(getText('N5V 0A5', language));

      setCityLabel(getText('City', language));
      setCityPlaceholder(getText('London', language));

      setCountry(language === 'nl-nl' ? 'The Netherlands' : 'United Kingdom');
      setCountryLabel(getText('Country', language));
      setCountryItems(getCountries(language));
      setSelectedCountry(language === 'nl-nl' ? 'The Netherlands' : 'United Kingdom');

      setVatIdLabel(getText('VAT Number', language));
      setVatIdPlaceholder(getText('NL123456789B01', language));

      setButtonText(getText('Pay Quote', language));
    }
  }, [language, visible]);

  useEffect(() => {
    const euCountries = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'];
    
    if (company && euCountries.includes(country)) {
      setShowVatid(true);
    } else {
      setShowVatid(false);
    }
  }, [country, company]);

  function onClick(event) {
    event.preventDefault();

    form.current.reportValidity();

    const valid = form.current.checkValidity();
    
    if (valid) {
      onChange(street, zipCode, city, country, vatId);
    }
  }

  return (
    <div
      className={classnames({
        [styles.address]: true,
        [styles.visible]: visible
      })}
    >
      <form ref={form}>
        
        <TextField
          label={ streetLabel }
          placeholder={ streetPlaceholder }
          onChange={setStreet}
          required
        />

        <TextField
          label={ zipCodeLabel }
          placeholder={ zipCodePlaceholder }
          onChange={setZipCode}
          required
        />

        <TextField
          label={ cityLabel }
          placeholder={ cityPlaceholder }
          onChange={setCity}
          required
        />

        <SelectField
          label={ countryLabel }
          items={ countryItems }
          selected={ selectedCountry }
          onChange={ setCountry }
        />

        <TextField
          label={ vatIdLabel }
          placeholder={ vatIdPlaceholder }
          onChange={setVatId}
          hide={!showVatid}
          required={showVatid}
        />

        <Button
          value={ buttonText }
          onClick={onClick}
        />
        
      </form>
    </div>
  )
}

Address.propTypes = {
  visible: PropTypes.bool,
  language: PropTypes.string.isRequired,
  onChange: PropTypes.func
}

Address.defaultProps = {
  onChange: () => {}
}

export default memo(Address);