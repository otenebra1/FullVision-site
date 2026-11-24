# App Full Vision (Android)

App em React Native (Expo) para os técnicos em campo e para a equipe.

- **Técnico:** Minhas OS, finalizar OS com fotos, checklist, assinatura e GPS, leitor de serial (código de barras/QR ou texto) e de placa.
- **Equipe (ADM e funcionário):** OS de hoje por técnico ao vivo, mapa dos técnicos, consulta por placa ou serial com o histórico de OS e o local de instalação, e cadastro de clientes e veículos.

Ele usa o mesmo Supabase do site e as rotas `/api/tecnico/*` publicadas na Vercel.

## Antes da primeira vez

1. No Supabase, rode `supabase/migrations/20261124e_perfis_funcionario_tecnico.sql` (se ainda não rodou) e depois `supabase/migrations/20261124f_app_mobile.sql`.
2. Faça o deploy do site (as rotas novas precisam estar no ar).
3. Na pasta `mobile`, copie `.env.example` para `.env.local` e preencha com os mesmos valores do site.

## Gerar o APK

```
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init --id <id do projeto no expo.dev>
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment preview --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SITE_URL --value https://www.fullvision.one --environment preview --visibility plaintext
npm run apk
```

O build roda na nuvem da Expo e no fim mostra um link e um QR code para baixar o APK. Abra o link no celular e instale (o Android pede para permitir apps desta fonte).

Mudou o app? Aumente `versionCode` em `app.json` e rode `npm run apk` de novo.

## Testar durante o desenvolvimento

`npx expo start` e abra no **Expo Go**. No Expo Go tudo funciona, menos a leitura de texto (placa e serial sem código de barras), que só existe no APK.

## Observações

- `src/lib/osConstants.js` é cópia de `lib/osConstants.js` do site. Mudou um, mude o outro.
- O app nunca mostra valores em R$.
