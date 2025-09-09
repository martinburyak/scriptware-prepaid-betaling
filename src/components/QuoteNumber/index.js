import React, {memo} from 'react';
import * as styles from './style.module.scss';
import PropTypes from 'prop-types';

function QuoteNumber({value}) {
  return (
    <div className={styles.quoteNumber}>{value}</div>
  )
}

QuoteNumber.propTypes = {
  value: PropTypes.string
}

QuoteNumber.defaultProps = {
  value: 'Q-00000-00'
}

export default memo(QuoteNumber);