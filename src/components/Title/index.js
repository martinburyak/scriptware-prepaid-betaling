import React, { memo } from 'react';
import * as styles from './style.module.scss';
import PropTypes from 'prop-types';

function Title({value}) {
  return (
    <div className={styles.title}>{value}</div>
  )
}

Title.propTypes = {
  value: PropTypes.string
}

Title.defaultProps = {
  value: ''
}

export default memo(Title);