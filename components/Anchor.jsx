import styles from './styles/formCard.module.css'

export default function Button({ children, ...props }) {
    return (
        <a 
            className={`${styles.buttonNavbar} flex items-center justify-center gap-2 whitespace-nowrap px-6 py-2 text-center transition-all duration-300 mx-auto`} 
            style={{ width: 'fit-content' }}
            {...props}
        >
            {children}
        </a>
    )
}