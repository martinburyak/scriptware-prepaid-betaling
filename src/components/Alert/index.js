import React, {memo} from 'react';
import * as styles from './style.module.scss';
import PropTypes from 'prop-types';
import classnames from 'classnames';

function Alert({value}) {
  return (
    <div
      className={classnames({
        [styles.alert]: true,
        [styles.show]: value
      })}
    >
      {value}
    </div>
  )
}

Alert.propTypes = {
  value: PropTypes.string
}

export default memo(Alert);