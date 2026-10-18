# agent-skills

Catálogo público de **skills** e **agentes (bots) prontos** para o app. Cada item é um conjunto de arquivos de texto revisáveis em pull request.

## O que tem aqui

```
skills/<slug>/SKILL.md        instruções da skill (mesmo formato das skills do app)
skills/<slug>/manifest.json   nome, descrição, versão, autor, categoria, tags, dicas de ferramentas, changelog
bots/<slug>/bot.json          modelo de agente: papel, aparência, skills, conectores sugeridos, rotinas sugeridas
bots/<slug>/README.md         explicação do agente
schema/                       JSON Schema de manifest.json e bot.json
scripts/build-index.mjs       valida tudo e gera o index.json
index.json                    índice que o app lê (gerado, não edite à mão)
```

Itens atuais: skill `roblox` (Luau + Rojo + publicação Open Cloud em lugar de teste) e agente `dev-roblox`.

## Como instalar pelo app

1. Abra o app, vá em **Explorar agentes** e escolha a aba **Skills** ou **Agentes**.
2. Abra um item para ver a descrição, as ferramentas que ele sugere, o conteúdo e o histórico de versões.
3. Toque em **Instalar**:
   - **Skill:** escolha onde instalar (sua conta ou um agente). Ela vira uma skill comum sua, que você pode editar.
   - **Agente:** revise nome, aparência e modelo, veja as skills que serão instaladas e os conectores recomendados. Rotinas sugeridas vêm desmarcadas.
4. Quando sair uma versão nova, o app mostra **Atualização disponível**. Se você editou sua cópia, ele mostra o resumo das diferenças e pergunta antes de sobrescrever.

O catálogo é lido de `https://raw.githubusercontent.com/ali-ali18/agent-skills/main`. Quem hospeda o app pode apontar para outro lugar com a variável `SKILLS_CATALOG_URL`.

## Como contribuir

Veja [CONTRIBUTING.md](CONTRIBUTING.md). Resumo: crie a pasta do item, rode `node scripts/build-index.mjs` e abra um pull request com o `index.json` atualizado. O app também pode abrir o PR por você a partir de **Publicar no marketplace** em uma skill sua.

## Regras de revisão

- Todo PR passa por `node scripts/build-index.mjs --check` (schema, consistência entre `SKILL.md` e `manifest.json`, índice atualizado) e por uma varredura de instruções suspeitas.
- Itens **bloqueados** pela varredura não são revisados até serem corrigidos. Itens **sinalizados** exigem revisão manual de quem faz o merge.
- Uma pessoa mantenedora lê o texto inteiro antes do merge: skills são instruções que um agente vai seguir.
- Mudou o conteúdo? Suba a versão (semver) e acrescente a entrada no topo do `changelog`.

## Regras de segurança

- **Skills nunca concedem permissões.** O campo `tools` é só uma dica do que a skill costuma usar; o app nunca o trata como autorização. Conectores, cofre e aprovações continuam sob controle do usuário.
- Proibido pedir ao agente para: enviar dados, chaves ou conteúdo do usuário para fora; ler, listar ou mostrar o cofre de segredos; desativar aprovações, confirmações ou salvaguardas; ignorar instruções anteriores ou regras do app; contatar endpoints desconhecidos.
- Comandos de rede (`curl`, `wget`) só para hosts conhecidos e necessários à tarefa (por exemplo `apis.roblox.com`, `github.com`). Outros hosts exigem justificativa e revisão manual.
- Segredos só entram por marcador do cofre (por exemplo `{{secret:NOME}}`), nunca como valor. Modelos de agente não carregam credenciais.
- Rotinas em `starterRoutines` são apenas **sugestões**: o usuário aprova cada uma.
- Todo conteúdo do catálogo é tratado como dado não confiável pelo app, que o valida e o mostra antes de instalar.

## Licença

MIT. Veja [LICENSE](LICENSE).
