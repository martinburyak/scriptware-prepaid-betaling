import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import * as styles from './style.module.scss';

function Textfield({label, placeholder, onChange, required, hide}) {
  const [filled, setFilled] = useState(false);

  function update(event) {
    onChange(event.currentTarget.value);

    if (event.target.value === '') {
      setFilled(false);
    } else {
      setFilled(true);
    }
  }

  return (
    <div className={classnames({
      [styles.textfield]: true,
      [styles.hide]: hide
    })}>
      <input
        className={styles.field}
        placeholder={placeholder}
        onChange={update}
        autoCorrect="off"
        autoComplete="off"
        required={required}
      />
      <label
        className={classnames({
          [styles.label]: true,
          [styles.filled]: filled
        })}
      >
        {label}
      </label>
    </div>
  )
}

Textfield.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  hide: PropTypes.bool
}

Textfield.defaultProps = {
  label: 'Label',
  placeholder: 'Placeholder',
  required: false,
  hide: false
}

export default memo(Textfield);