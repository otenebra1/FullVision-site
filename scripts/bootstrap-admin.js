// scripts/bootstrap-admin.js
//
// Uso único: cria o primeiro admin diretamente, sem passar pela API
// (já que a API exige que quem chama já seja admin).
//
// Como rodar:
//   node scripts/bootstrap-admin.js
//
// Depois de confirmar que o login funciona, pode apagar este arquivo.

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const EMAIL = 'atendimento@fullvision.one';       // <-- troque
const PASSWORD = '44793361';           // <-- troque
const USERNAME = 'admin';                          // <-- troque se quiser

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Criando usuário em auth.users...');
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (createError) {
    console.error('Erro ao criar usuário:', createError.message);
    process.exit(1);
  }

  console.log('Usuário criado:', created.user.id);
  console.log('Criando perfil (profiles)...');

  const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
    id: created.user.id,
    username: USERNAME,
    role: 'admin',
  }]);

  if (profileError) {
    console.error('Erro ao criar perfil:', profileError.message);
    console.error('Você pode reverter apagando o usuário criado no painel do Supabase (Authentication > Users).');
    process.exit(1);
  }

  console.log('Pronto! Admin criado com sucesso.');
  console.log(`Login: ${EMAIL} / senha que você definiu no script.`);
}

main();