import {readFile,writeFile} from 'node:fs/promises';
const path='src/app.js';
let source=await readFile(path,'utf8');
const before="document.querySelectorAll('[data-tab]')";
const after="document.querySelectorAll('.workspace-nav .tab[data-tab]')";
const count=source.split(before).length-1;
if(count!==0&&count!==2)throw Error('Unexpected navigation binding structure: '+count);
if(count===2)source=source.replaceAll(before,after);
if(!source.includes(after))throw Error('Scoped tab navigation is missing');
await writeFile(path,source);
const htmlPath='public/index.html';let html=await readFile(htmlPath,'utf8');
const css='<link rel="stylesheet" href="/luo-auth-navigation.css?v=20261023-1">';
if(!html.includes(css))html=html.replace('</head>',css+'</head>');
await writeFile(htmlPath,html);
console.log('Navigation bound to actual tabs; signed-out controls isolated');

const stabilityPath='public/luo-mobile-stability.js';let stability=await readFile(stabilityPath,'utf8');
const unstable="if(visible.some(x=>x!=='chats'))";
const stable="if(visible.includes('chats')&&visible.some(x=>x!=='chats'))";
if(!stability.includes(unstable)&&!stability.includes(stable))throw Error('Unknown mobile visibility reconciliation');
stability=stability.replace(unstable,stable);await writeFile(stabilityPath,stability);

const callCss='<link rel="stylesheet" href="/luo-call-quality.css?v=20261023-1">';
let callHtml=await readFile(htmlPath,'utf8');if(!callHtml.includes(callCss))await writeFile(htmlPath,callHtml.replace('</head>',callCss+'</head>'));
