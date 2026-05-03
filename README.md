# Neon Survivors

Um jogo web de sobrevivência estilo "Vampire Survivors", desenvolvido com JavaScript e a biblioteca **p5.js** para a disciplina de HTML5.

O jogador deve sobreviver ao maior número de ondas de inimigos possível, acumulando pontos ao derrotar as hordas que surgem continuamente. O ataque é automático — basta se mover e desviar!

## Nome dos integrantes

- [Seu Nome]
- [Nome da sua Dupla]

## Instruções de como usar

### Como rodar o projeto

1. **Opção 1 — Live Server (Recomendado):**
   - Abra a pasta do projeto no VS Code.
   - Instale a extensão **Live Server** (se ainda não tiver).
   - Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.

2. **Opção 2 — Abrir diretamente:**
   - Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge).

### Controles do jogo

| Ação          | Teclas                      |
|---------------|-----------------------------|
| Mover cima    | `W` ou `Seta para cima`     |
| Mover baixo   | `S` ou `Seta para baixo`    |
| Mover esquerda| `A` ou `Seta para esquerda` |
| Mover direita | `D` ou `Seta para direita`  |
| Confirmar     | `ENTER`                     |

- O ataque é **automático**: projéteis são disparados periodicamente em direção ao inimigo mais próximo.
- Derrote inimigos para ganhar **pontos**.
- Se sua vida chegar a **0**, é **Game Over**!

### Estrutura de arquivos

```
HTML5-Trab/
├── index.html   → Página principal (importa p5.js e sketch.js)
├── style.css    → Estilo básico (reset e centralização)
├── sketch.js    → Toda a lógica do jogo
└── README.md    → Este arquivo
```
