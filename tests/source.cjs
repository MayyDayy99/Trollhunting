// The game source as the build sees it: src/trollgen/*.js followed by src/game/*.js, each folder
// concatenated in file-name order (see build/concat-modules.js). Tests cut functions out of this
// text with start/end markers, so a function may span fragment files without breaking a test.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = dir => fs.readdirSync(path.join(root, dir)).filter(f => /^\d\d-.+\.js$/.test(f)).sort()
  .map(f => fs.readFileSync(path.join(root, dir, f), 'utf8').replace(/\r\n/g, '\n')).join('');

const trollgen = read('src/trollgen');
const game = read('src/game');
const source = trollgen + game;

function between(start, end, label = 'game') {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (!(a >= 0 && b > a)) throw new Error(`Missing ${label} source: ${start}`);
  return source.slice(a, b);
}

module.exports = { root, trollgen, game, source, between };
