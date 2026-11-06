import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { systemOptions, type EmulatorSystem } from '../lib/emulator-cores';
import {
  ALLOWED_IMAGE_HOSTS,
  ASPECT_RATIOS,
  DEFAULT_PLAY_THEMES,
  FRAME_STYLES,
  NEUTRAL_PLAY_THEME,
  contrastRatio,
  isAllowedImageUrl,
  isFrameStyle,
  isHexColor,
  pickTextColor,
  playThemeCssVars,
  resolvePlayTheme,
  validatePlayTheme,
  type PlayTheme
} from '../lib/play-theme';

// 0002F SF01 contract tests (plan.md Test Specification T01-T03, T09-T16).
// Expected theme values are the design.md Tokens JSON of SF01.

const SYSTEMS: EmulatorSystem[] = systemOptions.map((option) => option.value);
const ALL_THEMES: [string, PlayTheme][] = [
  ...SYSTEMS.map((system) => [system, DEFAULT_PLAY_THEMES[system]] as [string, PlayTheme]),
  ['neutral', NEUTRAL_PLAY_THEME]
];

const DESIGN_TOKENS: Record<string, Omit<PlayTheme, 'bgImage'>> = {
  NES: { frame: 'nes', bg: '#1F1F23', accent: '#FF4D4D', frameColor: '#C9C9C9', ar: '4/3', radius: '12px' },
  SNES: { frame: 'snes', bg: '#2A2833', accent: '#B6A6FF', frameColor: '#D3D3DB', ar: '4/3', radius: '12px' },
  'Nintendo 64': { frame: 'n64', bg: '#141414', accent: '#3BB273', frameColor: '#3A3A3A', ar: '4/3', radius: '12px' },
  'Game Boy': { frame: 'dmg', bg: '#1E2A1E', accent: '#9BBC0F', frameColor: '#C4C0B4', ar: '10/9', radius: '24px' },
  'Game Boy Color': { frame: 'gbc', bg: '#1B1530', accent: '#FFD23F', frameColor: '#7A3FB0', ar: '10/9', radius: '24px' },
  'Game Boy Advance': { frame: 'gba', bg: '#15142B', accent: '#8F8FFF', frameColor: '#4B3FA6', ar: '3/2', radius: '24px' },
  'Master System': { frame: 'sms', bg: '#121212', accent: '#FF4545', frameColor: '#2B2B2B', ar: '4/3', radius: '12px' },
  'Mega Drive / Genesis': { frame: 'megadrive', bg: '#0D0D0D', accent: '#F2C14E', frameColor: '#1A1A1A', ar: '4/3', radius: '12px' },
  'Game Gear': { frame: 'gamegear', bg: '#111111', accent: '#4FA3FF', frameColor: '#2A2A2A', ar: '10/9', radius: '24px' },
  PlayStation: { frame: 'ps', bg: '#1C1C24', accent: '#7FB2FF', frameColor: '#B9B9BE', ar: '4/3', radius: '12px' },
  'Arcade (FBNeo)': { frame: 'arcade', bg: '#0B0B1A', accent: '#FF3EA5', frameColor: '#1F1F3A', ar: '4/3', radius: '12px' },
  'Neo Geo': { frame: 'neogeo', bg: '#0E0E0E', accent: '#E3B23C', frameColor: '#2C2C2C', ar: '4/3', radius: '12px' },
  neutral: { frame: 'neutral', bg: '#09090B', accent: '#22D3EE', frameColor: '#27272A', ar: '4/3', radius: '16px' }
};

test('T01 each of the 12 systems has a valid default theme', () => {
  assert.equal(SYSTEMS.length, 12);
  for (const system of SYSTEMS) {
    const theme = DEFAULT_PLAY_THEMES[system];
    assert.ok(theme, system);
    assert.ok(isHexColor(theme.bg) && isHexColor(theme.accent) && isHexColor(theme.frameColor), system);
    assert.ok(FRAME_STYLES.includes(theme.frame), system);
    assert.ok(ASPECT_RATIOS.includes(theme.ar), system);
    assert.deepEqual(validatePlayTheme(theme, theme), theme, system);
  }
  assert.equal(new Set(SYSTEMS.map((system) => DEFAULT_PLAY_THEMES[system].frame)).size, 12);
});

test('T01 theme values match the design.md Tokens JSON', () => {
  for (const [name, theme] of ALL_THEMES) {
    assert.deepEqual(theme, DESIGN_TOKENS[name], name);
  }
});

test('T02 text and accent reach 4.5:1 on bg in all 13 themes', () => {
  for (const [name, theme] of ALL_THEMES) {
    assert.ok(contrastRatio(pickTextColor(theme.bg), theme.bg) >= 4.5, `${name} text`);
    assert.ok(contrastRatio(theme.accent, theme.bg) >= 4.5, `${name} accent`);
  }
});

test('T02 contrastRatio and pickTextColor follow the WCAG formula', () => {
  assert.equal(Number(contrastRatio('#000000', '#FFFFFF').toFixed(2)), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  assert.equal(pickTextColor('#09090B'), '#F4F4F5');
  assert.equal(pickTextColor('#F4F4F5'), '#18181B');
});

test('T03 known systems resolve to their console theme, without a database', () => {
  assert.deepEqual(resolvePlayTheme('SNES'), DEFAULT_PLAY_THEMES['SNES']);
  assert.deepEqual(resolvePlayTheme('Mega Drive / Genesis'), DEFAULT_PLAY_THEMES['Mega Drive / Genesis']);
  assert.deepEqual(resolvePlayTheme('Arcade'), DEFAULT_PLAY_THEMES['Arcade (FBNeo)']);
  const source = readFileSync(path.join(__dirname, '..', 'lib', 'play-theme.ts'), 'utf8');
  assert.doesNotMatch(source, /from ['"](react|@\/lib\/mongo|@\/lib\/data|\.\/mongo|\.\/data|mongodb)['"]/);
});

test('T09 no override returns the console default', () => {
  assert.deepEqual(resolvePlayTheme('NES', undefined), DEFAULT_PLAY_THEMES['NES']);
});

test('T10 a valid override is kept over the default', () => {
  const fallback = DEFAULT_PLAY_THEMES['NES'];
  const override = { bg: '#101820', frame: 'gba', bgImage: 'https://upload.wikimedia.org/a.png' };
  const expected = { ...fallback, bg: '#101820', frame: 'gba', bgImage: 'https://upload.wikimedia.org/a.png' };
  assert.deepEqual(validatePlayTheme(override, fallback), expected);
  assert.deepEqual(resolvePlayTheme('NES', override), expected);
});

test('T11 invalid fields fall back one by one', () => {
  const fallback = DEFAULT_PLAY_THEMES['NES'];
  for (const bg of ['red', '#FFF', '#GGGGGG', 42, null, '#1F1F23 ', 'url(x)']) {
    assert.equal(isHexColor(bg), false, String(bg));
    assert.equal(validatePlayTheme({ bg }, fallback).bg, fallback.bg, String(bg));
  }
  assert.equal(isFrameStyle('xbox'), false);
  assert.equal(validatePlayTheme({ frame: 'xbox' }, fallback).frame, fallback.frame);
  assert.equal(validatePlayTheme({ ar: '16/9' }, fallback).ar, fallback.ar);
  for (const radius of ['7px', 'calc(1px)', 12, '12px;color:red']) {
    assert.equal(validatePlayTheme({ radius }, fallback).radius, fallback.radius, String(radius));
  }
  assert.equal(validatePlayTheme({ radius: '24px' }, fallback).radius, '24px');
  assert.deepEqual(validatePlayTheme('not an object', fallback), fallback);
  assert.deepEqual(validatePlayTheme(null, fallback), fallback);
});

test('T12 an override with accent under 4.5:1 on bg returns the whole fallback', () => {
  const fallback = DEFAULT_PLAY_THEMES['NES'];
  assert.deepEqual(validatePlayTheme({ bg: '#101820', accent: '#202830' }, fallback), fallback);
  assert.deepEqual(validatePlayTheme({ bg: '#808080', frame: 'gba' }, fallback), fallback);
});

test('T13 allowed image hosts are accepted', () => {
  assert.deepEqual([...ALLOWED_IMAGE_HOSTS], ['i.imgur.com', 'upload.wikimedia.org', 'raw.githubusercontent.com']);
  for (const url of [
    'https://i.imgur.com/x.png',
    'https://upload.wikimedia.org/a/b.jpg',
    'https://raw.githubusercontent.com/a/b.png',
    'https://I.IMGUR.COM/x.png'
  ]) {
    assert.equal(isAllowedImageUrl(url), true, url);
  }
});

test('T14 image host attacks are refused', () => {
  for (const url of [
    'https://i.imgur.com.evil.com/x',
    'https://x.i.imgur.com/x',
    'http://i.imgur.com/x',
    'https://i.imgur.com:443/x',
    'https://i.imgur.com:8080/x',
    'https://user:pass@i.imgur.com/x',
    'https://user@i.imgur.com/x',
    'javascript:alert(1)',
    '//i.imgur.com/x',
    '',
    42,
    null
  ]) {
    assert.equal(isAllowedImageUrl(url), false, String(url));
  }
  const fallback = DEFAULT_PLAY_THEMES['NES'];
  assert.equal(validatePlayTheme({ bgImage: 'https://i.imgur.com.evil.com/x' }, fallback).bgImage, undefined);
});

test('T15 unknown systems get the neutral theme', () => {
  for (const system of ['Atari Jaguar', null, '', undefined]) {
    const theme = resolvePlayTheme(system);
    assert.deepEqual(theme, NEUTRAL_PLAY_THEME, String(system));
    assert.equal(theme.frame, 'neutral');
  }
});

test('T16 a known system does not get the neutral theme', () => {
  assert.equal(resolvePlayTheme('Game Boy').frame, 'dmg');
  assert.equal(resolvePlayTheme('Game Boy Color').frame, 'gbc');
  assert.notDeepEqual(resolvePlayTheme('Game Boy'), NEUTRAL_PLAY_THEME);
});

test('playThemeCssVars emits only the seven theme custom properties', () => {
  const vars = playThemeCssVars(DEFAULT_PLAY_THEMES['Game Boy']);
  assert.deepEqual(Object.keys(vars).sort(), ['--t-accent', '--t-ar', '--t-bg', '--t-frame', '--t-muted', '--t-radius', '--t-text']);
  assert.equal(vars['--t-bg'], '#1E2A1E');
  assert.equal(vars['--t-ar'], '10 / 9');
  assert.equal(vars['--t-text'], '#F4F4F5');
});
