import styles from './styles/formCard.module.css'

export default function FormCard({ title, children }) {
    return(
        <div className={styles.form}>
            <h1 className={styles.title}>{title}</h1>
            {children}
        </div>
    )
}