import React, {memo, createRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import * as styles from './style.module.scss';

function SelectField({label, items, selected, onChange}) {
  const field = createRef();

  useEffect(() => {
    field.current.value = selected
  }, [selected, field]);

  return (
    <div className={styles.selectfield}>
      <select className={styles.field} ref={field} onChange={event => { onChange(event.currentTarget.value) }}>
        {items.map((item, key) => (
          <option key={key} value={item.value}>{item.text}</option>
        ))}
      </select>
      <label className={styles.label}>{label}</label>
    </div>
  )
}

SelectField.propTypes = {
  label: PropTypes.string,
  items: PropTypes.array,
  selected: PropTypes.string
}

SelectField.defaultProps = {
  label: 'Label',
  items: [{ value: 'SelectField', text: 'SelectField'}]
}

export default memo(SelectField);