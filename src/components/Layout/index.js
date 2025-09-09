import React, {memo} from 'react';
import PropTypes from 'prop-types';
import * as styles from './style.module.scss';
import classNames from 'classnames';

function Layout({ children, loading }) {
  return (
    <div className={styles.layout}>
      <div className={styles.top}>
        <img src="/logo.png" className={styles.logo} alt="Logo" />
      </div>

      <div className={styles.middle}>
        <img
          src="/tail-spin.svg"
          alt="Loader"
          className={classNames({
            [styles.loader]: true,
            [styles.hidden]: !loading
          })}
        />

        <div
          className={classNames({
            [styles.container]: true,
            [styles.hidden]: loading
          })}
        >
          {children}
        </div>
      </div>

    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node,
  loading: PropTypes.bool  
}

Layout.defaultProps = {
  children: null,
  loading: false
}

export default memo(Layout);