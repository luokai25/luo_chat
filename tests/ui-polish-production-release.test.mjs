import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('UI-only release adds scoped polish without changing auth or public backend flags',async()=>{
 const html=await readFile('public/index.html','utf8');
 const css=await readFile('public/luo-micro-polish.css','utf8');
 const build=await readFile('build.mjs','utf8');
 assert.match(html,/href="\/luo-micro-polish\.css"/);
 assert.match(css,/--luo-micro-tap:44px/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(build,/release\/luo-ui-polish-20261027/);
 assert.doesNotMatch(html,/luo-agent-checkout\.js/);
});
