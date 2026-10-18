# Contribuindo

## Nova skill

1. Crie `skills/<slug>/` (slug em minúsculas com hífens, igual ao `name` do `SKILL.md`).
2. `SKILL.md` no formato das skills do app:

   ```
   ---
   name: meu-slug
   description: Quando usar esta skill (uma linha, até 300 caracteres)
   tools: [shell, secret_list]
   ---

   Corpo em markdown (até 16 KB).
   ```

   `tools` é só dica e deve ser igual ao do `manifest.json`.
3. `manifest.json` conforme `schema/manifest.schema.json`:

   ```json
   {
     "slug": "meu-slug",
     "name": "Nome legível",
     "description": "Igual ao description do SKILL.md",
     "version": "1.0.0",
     "author": "seu-usuario",
     "category": "games",
     "tags": ["exemplo"],
     "tools": ["shell"],
     "minAppVersion": "1.0.0",
     "changelog": [{ "version": "1.0.0", "date": "2026-10-17", "notes": "Primeira versão." }]
   }
   ```

## Novo agente

Crie `bots/<slug>/bot.json` (veja `schema/bot.schema.json`) e `bots/<slug>/README.md`. Campos principais: `name`, `description` (o papel do agente), `snippet`, `appearance` (`color` e `shape`), `suggestedModel` (opcional; sem ele vale o modelo padrão de quem instala), `skills` (slugs deste catálogo), `suggestedConnectors` e `setupNotes` (informativos), `starterRoutines` (sugestões com `name`, `prompt` e `cron`), `firstMessage`.

Nunca coloque credenciais, ids pessoais ou contatos em um modelo de agente.

## Antes de abrir o PR

```sh
node scripts/build-index.mjs         # valida e atualiza index.json
node scripts/build-index.mjs --check # o mesmo que a CI roda
node scripts/scan.test.mjs           # auto-testes da varredura
```

Inclua o `index.json` gerado no PR.

## Atualizando um item

Mude o conteúdo, suba `version` (semver) no manifest/bot e adicione a entrada nova **no topo** do `changelog`. Descreva no PR o que mudou e por quê.

## O que é recusado

Veja "Regras de segurança" no [README](README.md). Em resumo: nada de exfiltrar dados, ler o cofre, desativar salvaguardas, ignorar instruções do app ou chamar endpoints desconhecidos; skills não concedem permissão.
