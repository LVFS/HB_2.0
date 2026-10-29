// Test del registro delle cutscene (FASE 15): ogni video ha il suo file e i suoi sottotitoli, e i .vtt sono ben formati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { CUTSCENES } from '../src/data/cutscenes/registry.ts';

const PUBLIC = new URL('../public/', import.meta.url);

test('ogni voce del registro è un video o uno storyboard (mai nessuno dei due, mai entrambi)', () => {
  for (const [id, entry] of Object.entries(CUTSCENES)) {
    assert.ok(Boolean(entry.video) !== Boolean(entry.storyboard), id);
  }
});

test('i video esistono, sono ricompressi (sotto i 10 MB) e hanno i sottotitoli accanto', () => {
  const videos = Object.entries(CUTSCENES).filter(([, entry]) => entry.video);
  assert.ok(videos.length >= 2);
  for (const [id, entry] of videos) {
    const file = new URL(entry.video.src, PUBLIC);
    assert.ok(existsSync(file), `${id}: manca ${entry.video.src}`);
    assert.ok(statSync(file).size < 10 * 1024 * 1024, `${id}: oltre i 10 MB`);
    assert.ok(entry.video.src.endsWith('.mp4'), id);
    assert.ok(entry.video.subtitles, `${id}: senza sottotitoli`);
    assert.ok(existsSync(new URL(entry.video.subtitles, PUBLIC)), `${id}: manca ${entry.video.subtitles}`);
  }
});

test('i percorsi sono relativi a BASE_URL (niente slash iniziale né http)', () => {
  for (const entry of Object.values(CUTSCENES)) {
    for (const path of [entry.video?.src, entry.video?.subtitles]) {
      if (path) assert.ok(!path.startsWith('/') && !path.startsWith('http'), path);
    }
  }
});

test('i sottotitoli sono WebVTT con almeno una battuta e senza il refuso «Zalando»', () => {
  for (const entry of Object.values(CUTSCENES)) {
    if (!entry.video?.subtitles) continue;
    const text = readFileSync(new URL(entry.video.subtitles, PUBLIC), 'utf8');
    assert.ok(text.startsWith('WEBVTT'), entry.video.subtitles);
    assert.ok(/\d\d:\d\d\.\d{3} --> \d\d:\d\d\.\d{3}/.test(text), 'nessuna battuta');
    assert.ok(!/zalando/i.test(text), 'refuso Zalando');
  }
});
