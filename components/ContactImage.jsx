import React from 'react'
import styles from './styles/formCard.module.css'
import { Contact } from './FormContact'

const ContactImage = () => {
  return (
    <div className='flex items-center justify-center h-screen mb-12 bg-fixed bg-cover img-custom'>
        <div className='absolute top-0 left-0 right-0 bottom-0 bg-black/70 z-[2]' />
        <div className={styles.mobileClass}>
          <Contact />
        </div>
    </div>
  )
}

export default ContactImage