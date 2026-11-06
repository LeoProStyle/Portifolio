import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEmulatorSystem } from '../lib/emulator-cores';
import {
  DEFAULT_PLAY_THEMES,
  NEUTRAL_PLAY_THEME,
  contrastRatio,
  isAllowedImageUrl,
  pickTextColor,
  playThemeCssVars,
  resolvePlayTheme,
  validatePlayTheme,
  type PlayTheme
} from '../lib/play-theme';

// 0002F SF01 gap tests: edge inputs of the pure modules that the contract tests do not reach.

const IMG = 'https://i.imgur.com/a.png';

test('isAllowedImageUrl rejects a trailing-dot host', () => {
  assert.equal(isAllowedImageUrl('https://i.imgur.com./a.png'), false);
});

test('isAllowedImageUrl rejects whitespace, tab and newline in the authority', () => {
  assert.equal(isAllowedImageUrl('https://i.imgur.com /a.png'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com\t/a.png'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com\n/a.png'), false);
  assert.equal(isAllowedImageUrl('https:// i.imgur.com/a.png'), false);
});

test('isAllowedImageUrl rejects a disallowed host hidden behind a backslash', () => {
  assert.equal(isAllowedImageUrl('https://evil.com\\i.imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('https://evil.com\\@i.imgur.com/a.png'), false);
});

test('isAllowedImageUrl rejects a disallowed host that carries an allowed host in query or fragment', () => {
  assert.equal(isAllowedImageUrl('https://evil.com?i.imgur.com'), false);
  assert.equal(isAllowedImageUrl('https://evil.com#i.imgur.com'), false);
  assert.equal(isAllowedImageUrl('https://evil.com/?u=https://i.imgur.com/a.png'), false);
});

test('isAllowedImageUrl accepts an allowed host followed directly by a query or a fragment', () => {
  assert.equal(isAllowedImageUrl('https://i.imgur.com?x=1'), true);
  assert.equal(isAllowedImageUrl('https://i.imgur.com#frag'), true);
  assert.equal(isAllowedImageUrl('https://i.imgur.com/a.png?x=1#frag'), true);
});

test('isAllowedImageUrl compares host and scheme case-insensitively', () => {
  assert.equal(isAllowedImageUrl('https://I.IMGUR.COM/a.png'), true);
  assert.equal(isAllowedImageUrl('HTTPS://upload.wikimedia.org/x.png'), true);
});

test('isAllowedImageUrl rejects lookalike hosts, subdomains, ports and userinfo', () => {
  assert.equal(isAllowedImageUrl('https://x.i.imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com.evil.com/a.png'), false);
  assert.equal(isAllowedImageUrl('https://imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com:443/a.png'), false);
  assert.equal(isAllowedImageUrl('https://user@i.imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('https://user:pw@i.imgur.com/a.png'), false);
});

test('isAllowedImageUrl rejects other schemes, empty authority and non-strings', () => {
  assert.equal(isAllowedImageUrl('http://i.imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('//i.imgur.com/a.png'), false);
  assert.equal(isAllowedImageUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedImageUrl('https://'), false);
  assert.equal(isAllowedImageUrl('https:///a.png'), false);
  assert.equal(isAllowedImageUrl(''), false);
  for (const value of [undefined, null, 42, {}, [], true]) {
    assert.equal(isAllowedImageUrl(value), false);
  }
});

test('validatePlayTheme keeps a valid bgImage from the fallback when the input bgImage is invalid', () => {
  const fallback: PlayTheme = { ...NEUTRAL_PLAY_THEME, bgImage: IMG };
  const result = validatePlayTheme({ bgImage: 'https://evil.com/a.png' }, fallback);
  assert.equal(result.bgImage, IMG);
});

test('validatePlayTheme keeps the fallback bgImage when the input has none', () => {
  const fallback: PlayTheme = { ...NEUTRAL_PLAY_THEME, bgImage: IMG };
  assert.equal(validatePlayTheme({ accent: '#FFFFFF' }, fallback).bgImage, IMG);
});

test('validatePlayTheme lets a valid input bgImage replace the fallback bgImage', () => {
  const fallback: PlayTheme = { ...NEUTRAL_PLAY_THEME, bgImage: IMG };
  const next = 'https://upload.wikimedia.org/b.png';
  assert.equal(validatePlayTheme({ bgImage: next }, fallback).bgImage, next);
});

test('validatePlayTheme leaves bgImage out when neither input nor fallback has a valid one', () => {
  const result = validatePlayTheme({ bgImage: 'http://i.imgur.com/a.png' }, NEUTRAL_PLAY_THEME);
  assert.equal('bgImage' in result, false);
});

test('validatePlayTheme returns the fallback itself for non-object input', () => {
  for (const value of [null, undefined, 'x', 7, true, [], [NEUTRAL_PLAY_THEME]]) {
    assert.equal(validatePlayTheme(value, NEUTRAL_PLAY_THEME), NEUTRAL_PLAY_THEME);
  }
});

test('validatePlayTheme replaces each invalid field with the same fallback field only', () => {
  const result = validatePlayTheme(
    { frame: 'bogus', bg: 'red', accent: '#FFFFFF', frameColor: '#12345', ar: '16/9', radius: '13px' },
    NEUTRAL_PLAY_THEME
  );
  assert.deepEqual(result, { ...NEUTRAL_PLAY_THEME, accent: '#FFFFFF' });
});

test('validatePlayTheme returns the fallback when the accent would be unreadable on the background', () => {
  const result = validatePlayTheme({ bg: '#FFFFFF', accent: '#FFFFFF' }, NEUTRAL_PLAY_THEME);
  assert.equal(result, NEUTRAL_PLAY_THEME);
});

test('validatePlayTheme accepts a light background with a dark accent', () => {
  const result = validatePlayTheme({ bg: '#FFFFFF', accent: '#000000' }, NEUTRAL_PLAY_THEME);
  assert.equal(result.bg, '#FFFFFF');
  assert.equal(result.accent, '#000000');
});

test('contrastRatio is 21 for black on white, 1 for equal colors, and symmetric', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 1e-9);
  assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 1e-9);
  assert.equal(contrastRatio('#123456', '#ABCDEF'), contrastRatio('#ABCDEF', '#123456'));
});

test('pickTextColor picks dark text on light backgrounds and light text on dark ones', () => {
  assert.equal(pickTextColor('#FFFFFF'), '#18181B');
  assert.equal(pickTextColor('#000000'), '#F4F4F5');
});

test('playThemeCssVars derives a light muted color at 0.72 opacity on a dark theme', () => {
  const vars = playThemeCssVars(NEUTRAL_PLAY_THEME);
  assert.equal(vars['--t-text'], '#F4F4F5');
  assert.equal(vars['--t-muted'], 'rgba(244, 244, 245, 0.72)');
});

test('playThemeCssVars derives dark text and a dark muted color on a light theme', () => {
  const light: PlayTheme = { ...NEUTRAL_PLAY_THEME, bg: '#FFFFFF', accent: '#000000' };
  const vars = playThemeCssVars(light);
  assert.equal(vars['--t-text'], '#18181B');
  assert.equal(vars['--t-muted'], 'rgba(24, 24, 27, 0.72)');
});

test('playThemeCssVars spaces the aspect ratio and exposes exactly seven variables', () => {
  const vars = playThemeCssVars({ ...NEUTRAL_PLAY_THEME, ar: '10/9', bgImage: IMG });
  assert.equal(vars['--t-ar'], '10 / 9');
  assert.deepEqual(Object.keys(vars).sort(), [
    '--t-accent',
    '--t-ar',
    '--t-bg',
    '--t-frame',
    '--t-muted',
    '--t-radius',
    '--t-text'
  ]);
  assert.ok(!Object.values(vars).some((value) => value.includes('imgur')));
});

test('resolvePlayTheme returns the neutral theme for unknown, empty and missing systems', () => {
  assert.equal(resolvePlayTheme('totally unknown'), NEUTRAL_PLAY_THEME);
  assert.equal(resolvePlayTheme(''), NEUTRAL_PLAY_THEME);
  assert.equal(resolvePlayTheme(null), NEUTRAL_PLAY_THEME);
  assert.equal(resolvePlayTheme(undefined), NEUTRAL_PLAY_THEME);
});

test('resolvePlayTheme validates an override against the console default', () => {
  assert.equal(resolvePlayTheme('snes', { bg: '#FFFFFF', accent: '#FFFFFF' }), DEFAULT_PLAY_THEMES.SNES);
  assert.equal(resolvePlayTheme('unknown', 'not an object'), NEUTRAL_PLAY_THEME);
  assert.equal(resolvePlayTheme('snes', { accent: '#FFFFFF' }).accent, '#FFFFFF');
});

test('resolveEmulatorSystem lets snes win over nes and the GBA/GBC aliases win over game boy', () => {
  assert.equal(resolveEmulatorSystem('snes'), 'SNES');
  assert.equal(resolveEmulatorSystem('Super Nintendo'), 'SNES');
  assert.equal(resolveEmulatorSystem('sfc'), 'SNES');
  assert.equal(resolveEmulatorSystem('nes'), 'NES');
  assert.equal(resolveEmulatorSystem('Famicom NES'), 'NES');
  assert.equal(resolveEmulatorSystem('gba'), 'Game Boy Advance');
  assert.equal(resolveEmulatorSystem('game boy advance sp'), 'Game Boy Advance');
  assert.equal(resolveEmulatorSystem('gbc'), 'Game Boy Color');
  assert.equal(resolveEmulatorSystem('gb'), 'Game Boy');
  assert.equal(resolveEmulatorSystem('Game Boy'), 'Game Boy');
});

test('resolveEmulatorSystem trims, ignores case and resolves legacy aliases', () => {
  assert.equal(resolveEmulatorSystem('  NES  '), 'NES');
  assert.equal(resolveEmulatorSystem('MASTER SYSTEM'), 'Master System');
  assert.equal(resolveEmulatorSystem('game gear'), 'Game Gear');
  assert.equal(resolveEmulatorSystem('n64'), 'Nintendo 64');
  assert.equal(resolveEmulatorSystem('Sega Mega Drive'), 'Mega Drive / Genesis');
  assert.equal(resolveEmulatorSystem('genesis'), 'Mega Drive / Genesis');
  assert.equal(resolveEmulatorSystem('psx'), 'PlayStation');
  assert.equal(resolveEmulatorSystem('playstation 2'), 'PlayStation');
  assert.equal(resolveEmulatorSystem('neo geo'), 'Neo Geo');
  assert.equal(resolveEmulatorSystem('fbneo'), 'Arcade (FBNeo)');
});

test('resolveEmulatorSystem returns null for empty, blank, missing and unknown values', () => {
  assert.equal(resolveEmulatorSystem(''), null);
  assert.equal(resolveEmulatorSystem('   '), null);
  assert.equal(resolveEmulatorSystem(null), null);
  assert.equal(resolveEmulatorSystem(undefined), null);
  assert.equal(resolveEmulatorSystem('atari 2600'), null);
});

test('isAllowedImageUrl refuses characters that could break out of a CSS url(...)', () => {
  assert.equal(isAllowedImageUrl('https://i.imgur.com/a.png"), url("https://evil.example/t.gif'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com\evil'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com/a b'), false);
  assert.equal(isAllowedImageUrl("https://i.imgur.com/a'b.png"), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com/a<b>.png'), false);
  assert.equal(isAllowedImageUrl('https://i.imgur.com/a\u0001.png'), false);
});

test('validatePlayTheme stores the normalized href of an accepted bgImage', () => {
  const fallback = DEFAULT_PLAY_THEMES.NES;
  const theme = validatePlayTheme({ bgImage: 'https://I.IMGUR.COM/x.png' }, fallback);
  assert.equal(theme.bgImage, 'https://i.imgur.com/x.png');
});
