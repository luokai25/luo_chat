import {Resvg} from '@resvg/resvg-js';import {readFile,writeFile} from 'node:fs/promises';
// Package the supplied artwork without redrawing it. Different safe padding for OS masks.
const svg=await readFile('public/icon.svg','utf8');
for(const size of [32,180,192,512,1024])await writeFile('public/icon-'+size+'.png',new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
const maskable=svg.replace('viewBox="265 245 1080 1080"','viewBox="0 0 1600 1600"');
await writeFile('public/icon-maskable-512.png',new Resvg(maskable,{fitTo:{mode:'width',value:512}}).render().asPng());
console.log('Supplied Luo Chat artwork packaged for favicon, Apple, standard and maskable app icons');
