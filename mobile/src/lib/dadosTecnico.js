// Último pacote de /api/tecnico/dados, para a tela de finalizar OS não buscar de novo
let atual = null;
export const setDadosTecnico = (d) => { atual = d; };
export const getDadosTecnico = () => atual;
