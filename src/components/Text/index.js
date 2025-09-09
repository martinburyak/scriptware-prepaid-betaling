import React, { memo } from 'react';
import * as styles from './style.module.scss';
import PropTypes from 'prop-types';

function Text({value}) {
  return (
    <div className={styles.text} dangerouslySetInnerHTML={{__html:value}}></div>
  )
}

Text.propTypes = {
  value: PropTypes.string
}

Text.defaultProps = {
  value: ''
}

export default memo(Text);