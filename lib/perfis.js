// lib/perfis.js
// Perfis de login (coluna profiles.role):
//   admin       → ADM: vê e faz tudo
//   funcionario → todas as telas, menos as funções só de ADM (preços, valores em R$, usuários, exclusões)
//   tecnico     → só a tela de OS (/tecnico), com as OS atribuídas a ele
//   cliente     → área do cliente

export const PERFIS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'funcionario', label: 'Funcionário' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'admin', label: 'ADM' },
];

export const rotuloPerfil = (role) => PERFIS.find(p => p.value === role)?.label || 'Cliente';

export const ehAdmin = (role) => role === 'admin';
// Equipe interna: ADM e funcionário usam o painel
export const ehEquipe = (role) => role === 'admin' || role === 'funcionario';
export const ehTecnico = (role) => role === 'tecnico';
// Só cliente fica preso a uma empresa
export const perfilTemEmpresa = (role) => !role || role === 'cliente';
