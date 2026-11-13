import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, setOption, toParagraphs, wrap } from '../src/core.ts';

test('wrap respects width, keeps every word, tracks paragraphs', () => {
  const paras = ['um dois tres quatro cinco seis', 'palavramuitolongademais fim'];
  const lines = wrap(paras, 10);
  assert.ok(lines.every((l) => l.text.length <= 10));
  assert.equal(lines.filter((l) => l.para === 0).map((l) => l.text).join(' ').trim(), paras[0]);
  assert.deepEqual(lines.filter((l) => l.para === 1).map((l) => l.text), ['palavramui', 'tolongadem', 'ais fim', '']);
});

test('toParagraphs joins hard-wrapped lines and hyphen splits', () => {
  const text = [
    'Esta linha tem o comprimento cheio de uma pagi-',
    'na de livro e continua na proxima linha aqui ok',
    'terminando curto.',
    'Outro paragrafo com o comprimento cheio de novo',
    'fim.',
    '',
    'Terceiro.',
  ].join('\n');
  assert.deepEqual(toParagraphs(text), [
    'Esta linha tem o comprimento cheio de uma pagina de livro e continua na proxima linha aqui ok terminando curto.',
    'Outro paragrafo com o comprimento cheio de novo fim.',
    'Terceiro.',
  ]);
});

test('setOption validates', () => {
  const cfg = structuredClone(DEFAULTS);
  setOption(cfg, 'lines', '12');
  setOption(cfg, 'color', 'green');
  assert.equal(cfg.lines, 12);
  assert.equal(cfg.color, 'green');
  for (const [k, v] of [['lines', '0'], ['lines', 'abc'], ['width', '5'], ['color', 'toString'], ['books', '1']]) {
    assert.throws(() => setOption(cfg, k, v));
  }
});
