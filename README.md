# devook

Leitor de livros no terminal. Converte PDF e Word (`.docx`) em texto e exibe página a página, com linhas por página, comprimento da linha, espaçamento e cor configuráveis.

## Instalação

Requer Node.js 20+.

```sh
git clone https://github.com/raonych/devook.git
cd devook
npm install
npm link
```

## Uso

```sh
devook "caminho/do/livro.pdf"
devook livro.docx --lines 15 --width 60 --color green
```

O devook lembra onde você parou em cada livro.

### Teclas durante a leitura

| Tecla | Ação |
|---|---|
| `→` `espaço` `enter` | próxima página |
| `←` `b` | página anterior |
| `+` `-` | mais / menos linhas por página |
| `>` `<` | linha mais larga / mais estreita |
| `c` | troca a cor |
| `s` | troca o espaçamento entre linhas |
| `q` `ctrl+c` | sai |

### Comandos de configuração

Funcionam sem livro aberto. Sem valor, mostram o valor atual.

```sh
devook lines 20      # linhas exibidas por página (1-200)
devook width 80      # comprimento máximo da linha (20-300)
devook color cyan    # default, red, green, yellow, blue, magenta, cyan, white, gray
devook spacing 1     # linhas em branco entre as linhas (0-3)
devook margin 4      # margem esquerda (0-40)
devook config        # mostra tudo
devook help
```

As configurações ficam em `~/.devook.json`. Alterações feitas durante a leitura, pelas teclas ou por `--opções`, também são salvas.

## Limitações

- **Tamanho da fonte** é controlado pelo emulador de terminal, não por programas que rodam nele. Use `ctrl +` / `ctrl -` no terminal; `spacing` e `margin` ajudam a arejar o texto.
- PDFs escaneados (imagem) não têm texto para extrair; não há OCR.
- `.doc` antigo não é suportado, só `.docx`.
- Os parágrafos de PDFs são reconstruídos por heurística e podem sair unidos ou quebrados em alguns livros.

## Desenvolvimento

```sh
npm run build
npm test
```

## Licença

MIT
