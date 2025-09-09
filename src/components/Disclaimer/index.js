import React, {memo, useState, useEffect} from 'react';
import * as styles from './style.module.scss';
import getText from '../../utils/getText';
import PropTypes from 'prop-types';

function Disclaimer({language}) {
  const [disclaimer, setDisclaimer] = useState();

  useEffect(() => {
    setDisclaimer(getText('Payment secured and provided by', language));
  }, [language]);

  return (
    <div className={styles.disclaimer}>
      <a className={styles.link} href="https://www.mollie.com">
        <img className={styles.before} src="/lock.svg" alt="" />
        <span>{ disclaimer }</span>
        <img className={styles.after} src="/logo.svg" alt="" />
      </a>
    </div>
  )
}

Disclaimer.propTypes = {
  language: PropTypes.string
}

export default memo(Disclaimer);