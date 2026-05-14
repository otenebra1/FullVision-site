import React from 'react'
import FormCard from './Card'
import Button from './Anchor'
import { BsBoxArrowUpRight } from 'react-icons/bs';

const Redirect = () => {
  return (
    <div id='trackapp' className='flex justify-center my-12 px-4'>
        <FormCard title='Acessar plataforma de rastreamento'>
            <Button href="https://tracker.fullvision.one/v1/home">
                Full Vision Tracker 
                <BsBoxArrowUpRight className='inline-block ml-2 font-bold' />
            </Button>
        </FormCard>
    </div>
  )
}

export default Redirect;