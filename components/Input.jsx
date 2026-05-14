import styles from './styles/input.module.css'
import { useEffect, useRef } from 'react';

export default function InputField({id, placeholder, ...props}) {
    const labelRef = useRef(null);
    const cutRef = useRef(null);

    useEffect(() => {
        if (labelRef.current && cutRef.current) {
            const labelWidth = labelRef.current.getBoundingClientRect().width;
            cutRef.current.style.width = `${labelWidth + 10}px`; // adiciona um pouco de espaço extra
        }
    }, [placeholder]);

    return(
        <div className={styles.inputContainer}>
            <input id={id} className={styles.input} placeholder=" " {...props}/>
            <div ref={cutRef} className={styles.cut}></div>
            <label ref={labelRef} htmlFor={id} className={styles.placeholder}>{placeholder}</label>
        </div>
    )
}