# Fazenda Varela IA

Aplicativo inicial em Next.js (App Router, TypeScript) conectado ao projeto Supabase existente. Login por link de e-mail, criação da fazenda, cadastro e leitura de animais, e painel com contadores reais de animais, lotes, produção de leite e transações.

## Executar

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000. Configure `NEXT_PUBLIC_SITE_URL` na hospedagem com a URL pública do aplicativo. No Supabase, em **Authentication → URL Configuration**, configure Site URL e a URL de redirecionamento `https://seu-dominio/auth/callback` (e `http://localhost:3000/auth/callback` para desenvolvimento). O projeto Supabase ativo é `fdpccfgpwnfshdskapwi`. A chave neste exemplo é **publishable**, própria para código cliente. Nunca adicione uma chave secret ou service role ao repositório.

Na Vercel, a URL e a chave publishable têm valores públicos padrão em `src/lib/supabase/config.ts`. O login usa `NEXT_PUBLIC_SITE_URL`, ou a URL de produção fornecida pela Vercel. Configure a URL definitiva também no Supabase antes de testar o link de acesso por e-mail.

## Estrutura

- `src/app`: tela inicial, ações de login, cadastro da fazenda e de animais, callback da autenticação.
- `src/lib/supabase`: cliente servidor e atualização de sessão no middleware.
- O banco existente já contém tabelas protegidas por RLS. A função usada pelas políticas fica no esquema `private` e pode ser executada pelo papel `authenticated`. Nenhum dado fictício é gravado automaticamente.

## Próximos passos

Adicionar pesagens, leite e finanças, papéis de equipe e deploy com variáveis de ambiente configuradas.
