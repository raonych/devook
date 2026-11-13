#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  COLORS, OPTION_KEYS, loadConfig, saveConfig, setOption, toParagraphs, wrap,
  type Config, type NumKey,
} from './core.ts';

const HELP = `devook — leitor de livros (PDF, DOCX) no terminal

Uso:
  devook <arquivo> [--lines N] [--width N] [--color COR] [--spacing N] [--margin N]
  devook lines [N]      linhas exibidas por página
  devook width [N]      comprimento máximo da linha
  devook color [COR]    ${Object.keys(COLORS).join(', ')}
  devook spacing [N]    linhas em branco entre as linhas (0-3)
  devook margin [N]     margem esquerda
  devook config         mostra as configurações atuais
  devook help           mostra esta ajuda

Sem valor, o comando mostra o valor atual. Tudo fica salvo em ~/.devook.json.

Teclas durante a leitura:
  →  espaço  enter    próxima página
  ←  b                página anterior
  +  -                mais / menos linhas por página
  >  <                linha mais larga / mais estreita
  c                   troca a cor
  s                   troca o espaçamento
  q  ctrl+c           sai (a posição no livro fica salva)

Tamanho da fonte é do terminal, não do devook: use ctrl + / ctrl - nele.
`;

async function extract(path: string): Promise<string> {
  const ext = extname(path).toLowerCase();
  if (ext === '.pdf') {
    const { extractText } = await import('unpdf');
    return (await extractText(new Uint8Array(await readFile(path)), { mergePages: true })).text;
  }
  if (ext === '.docx') {
    const mammoth = (await import('mammoth')).default;
    return (await mammoth.extractRawText({ path })).value;
  }
  if (ext === '.txt') return readFile(path, 'utf8');
  throw new Error(`formato não suportado: "${ext || path}". Use .pdf, .docx ou .txt`);
}

function read(paras: string[], cfg: Config, bookKey: string): void {
  const { stdin, stdout: out } = process;
  const pad = () => ' '.repeat(cfg.margin);

  if (!out.isTTY || !stdin.isTTY) {
    out.write(wrap(paras, cfg.width).map((l) => pad() + l.text).join('\n') + '\n');
    return;
  }

  // Effective values: configured ones, clamped to what fits on screen right now.
  const width = () => Math.max(20, Math.min(cfg.width, out.columns - cfg.margin - 1));
  const perPage = () => Math.max(1, Math.min(cfg.lines, Math.floor((out.rows - 2) / (cfg.spacing + 1))));

  let lines = wrap(paras, width());
  let top = 0;
  const seek = (para: number) => { top = Math.max(0, lines.findIndex((l) => l.para >= para)); };
  seek(Number(cfg.books[bookKey]) || 0);

  const draw = () => {
    const n = perPage();
    const body = lines.slice(top, top + n).map((l) => pad() + l.text).join('\n'.repeat(cfg.spacing + 1));
    const pct = Math.round((Math.min(lines.length, top + n) / lines.length) * 100);
    const status = `${pad()}${pct}% · ←/→ página · +/- linhas · </> largura · c cor · s espaço · q sair`;
    out.write(
      `\x1b[2J\x1b[H\x1b[${COLORS[cfg.color]}m${body}\x1b[0m` +
      `\x1b[${out.rows};1H\x1b[2m${status.slice(0, out.columns - 1)}\x1b[0m`,
    );
  };
  // Re-wrap to the current width, landing on the line holding the same text as before.
  const reflow = () => {
    const para = lines[top].para;
    let chars = 0;
    for (let i = top - 1; i >= 0 && lines[i].para === para; i--) chars += lines[i].text.length + 1;
    lines = wrap(paras, width());
    seek(para);
    while (chars >= lines[top].text.length + 1 && lines[top + 1]?.para === para) {
      chars -= lines[top++].text.length + 1;
    }
  };
  const bump = (key: NumKey, shown: number, delta: number) => {
    try { setOption(cfg, key, String(shown + delta)); } catch { /* at the limit: ignore */ }
  };

  out.write('\x1b[?1049h\x1b[?25l'); // alternate screen, hide cursor
  process.on('exit', () => out.write('\x1b[?25h\x1b[?1049l'));
  out.on('resize', () => { reflow(); draw(); });

  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.on('data', (key: string) => {
    const n = perPage();
    if (key === 'q' || key === '\x03') {
      cfg.books[bookKey] = lines[top].para;
      saveConfig(cfg);
      process.exit(0);
    }
    if (key === '\x1b[C' || key === ' ' || key === '\r') { if (top + n < lines.length) top += n; }
    else if (key === '\x1b[D' || key === 'b') top = Math.max(0, top - n);
    else if (key === '+') bump('lines', n, 1);
    else if (key === '-') bump('lines', n, -1);
    else if (key === '>') { bump('width', width(), 2); reflow(); }
    else if (key === '<') { bump('width', width(), -2); reflow(); }
    else if (key === 's') cfg.spacing = (cfg.spacing + 1) % 4;
    else if (key === 'c') {
      const names = Object.keys(COLORS);
      cfg.color = names[(names.indexOf(cfg.color) + 1) % names.length];
    } else return;
    draw();
  });
  draw();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, value] = argv;
  const cfg = loadConfig();

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === 'config') {
    for (const key of OPTION_KEYS) console.log(`${key}: ${cfg[key as NumKey | 'color']}`);
    return;
  }
  if (OPTION_KEYS.includes(cmd)) {
    if (value !== undefined) {
      setOption(cfg, cmd, value);
      saveConfig(cfg);
    }
    console.log(`${cmd}: ${cfg[cmd as NumKey | 'color']}`);
    return;
  }

  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: Object.fromEntries(OPTION_KEYS.map((k) => [k, { type: 'string' as const }])),
  });
  if (positionals.length !== 1) throw new Error('informe um único arquivo. Veja: devook help');
  for (const [key, v] of Object.entries(values)) setOption(cfg, key, String(v));

  const path = resolve(positionals[0]);
  const paras = toParagraphs(await extract(path));
  if (!paras.length) {
    throw new Error('nenhum texto encontrado. PDF escaneado (imagem)? OCR não é suportado.');
  }
  read(paras, cfg, path);
}

main().catch((err: NodeJS.ErrnoException) => {
  console.error(`devook: ${err.code === 'ENOENT' ? `arquivo não encontrado: ${err.path}` : err.message}`);
  process.exit(1);
});
