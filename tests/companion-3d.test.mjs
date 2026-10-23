import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountCompanion3D} from '../src/companion-3d.js';

test('Shared companions render actual 3D mesh geometry without remote art or continuous motion when reduced motion is on',()=>{
 const dom=new JSDOM('<div id="companion"></div>',{url:'https://luo.example'}),w=dom.window,host=w.document.getElementById('companion');
 let rendered=0;
 const context={createLinearGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},arc(){},ellipse(){},fill(){rendered++},moveTo(){},lineTo(){},closePath(){},stroke(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>context;
 w.matchMedia=()=>({matches:true});
 w.requestAnimationFrame=()=>{throw Error('Reduced motion must not animate continuously')};
 const stop=mountCompanion3D(host,{species:'dragon',name:'Sage',home:'stars',cosmetic:'crown'});
 const canvas=host.querySelector('canvas');
 assert.ok(canvas,'Canvas is mounted');
 assert.match(canvas.getAttribute('aria-label'),/Rotatable 3D dragon named Sage/);
 assert.ok(rendered>20,'Multiple shaded 3D faces were drawn');
 stop();w.close();
});
