import React, {memo} from 'react';
import * as styles from './style.module.scss';

function CompanyName() {
  return (
    <div className={styles.companyName}>Scriptware Translations</div>
  )
}

export default memo(CompanyName);