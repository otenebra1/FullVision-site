// scripts/fix-admin-email.js
//
// Corrige o email de um usuário já criado (ex: se o bootstrap-admin.js
// rodou com o email placeholder por engano).
//
// Como rodar:
//   node scripts/fix-admin-email.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const OLD_EMAIL = 'SEU_EMAIL_AQUI@exemplo.com'; // o email errado que foi criado
const NEW_EMAIL = 'atendimento@fullvision.one';  // <-- troque pelo email correto

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Precisamos achar o UUID do usuário pelo email antigo
  console.log('Buscando usuário com email antigo...');
  const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('Erro ao listar usuários:', listError.message);
    process.exit(1);
  }

  const target = usersList.users.find(u => u.email === OLD_EMAIL);
  if (!target) {
    console.error(`Nenhum usuário encontrado com o email ${OLD_EMAIL}`);
    process.exit(1);
  }

  console.log('Usuário encontrado:', target.id);
  console.log('Atualizando email...');

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    email: NEW_EMAIL,
    email_confirm: true,
  });

  if (updateError) {
    console.error('Erro ao atualizar email:', updateError.message);
    process.exit(1);
  }

  console.log(`Pronto! Email atualizado de ${OLD_EMAIL} para ${NEW_EMAIL}.`);
  console.log('O perfil em "profiles" não precisa de nenhuma alteração (o id/uuid não mudou).');
}

main();