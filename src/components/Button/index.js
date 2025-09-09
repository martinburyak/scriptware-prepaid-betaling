import React, {memo} from 'react';
import PropTypes from 'prop-types';
import * as styles from './style.module.scss';

function Button({value, onClick}) {
  return (
    <button
      className={styles.button}
      onClick={onClick}
    >
      {value}
      <span
        className={styles.indicator}
      >
        ›
      </span>
    </button>
  )
}

Button.propTypes = {
  value: PropTypes.string,
  onClick: PropTypes.func
}

Button.defaultProps = {
  value: 'Button',
  onClick: () => {}
}

export default memo(Button);