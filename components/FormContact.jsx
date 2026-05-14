import React, { useRef, useState, useEffect } from "react";
import styles from "./styles/formCard.module.css";
import FormCard from "./Form";
import InputField from "./Input";
import emailjs from "@emailjs/browser";

export const Contact = () => {
  const form = useRef();
  const modalDisplayTime = 7000;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let timeout;
    if (showModal) {
      timeout = setTimeout(() => {
        setShowModal(false);
      }, modalDisplayTime);
    }
    return () => clearTimeout(timeout);
  }, [showModal]);

  const sendEmail = (e) => {
    e.preventDefault();

    emailjs
      .sendForm(
        "service_8mjaszr",
        "template_mjunhj6",
        form.current,
        "vrTPuJmXGr5IDX1Rc"
      )
      .then(
        (result) => {
          console.log(result.text);
          setShowModal(true);
          e.target.reset();
        },
        (error) => {
          console.log(error.text);
        }
      );
  };

  return (
    <div className={styles.background}>
      <FormCard title="Preencha os campos abaixo:">
        <form ref={form} onSubmit={sendEmail} className={styles.form}>
          <InputField
            type="text"
            placeholder="Nome completo"
            name="user_name"
          />
          <InputField type="text" placeholder="Empresa" name="user_company" />
          <InputField
            type="text"
            placeholder="Número de veículos"
            name="amount_vehicles"
          />
          <InputField
            type="text"
            placeholder="Contato Whatsapp"
            name="user_phone"
          />
          <InputField
            type="email"
            placeholder="Contato E-mail"
            name="user_email"
          />
          <button type="submit" value="Send" className={styles.buttonCard}>
            Confirmar
          </button>
          {showModal && (
            <div className="flex justify-center align-middle text-2xl text-green-500">
              Formulário enviado com sucesso
              <span class="material-symbols-outlined">check</span>
            </div>
          )}
        </form>
      </FormCard>
    </div>
  );
};
