import assert from 'node:assert/strict';
import {jaccard,suggestRelations,dashboardStats,parseFlexibleJson,parseCsv} from './core.mjs';
assert(jaccard('App pedidos comercio','Aplicación de pedidos para comercio') > 0.2);
const parsed=parseFlexibleJson([{id:'1',title:'Chat prueba',create_time:1700000000,mapping:{}}]);
assert.equal(parsed[0].type,'chat');
assert.equal(parsed[0].id,'1');
const csv=parseCsv('title,type,status\n"Uno",chat,activo\n');
assert.equal(csv.length,1);assert.equal(csv[0].status,'activo');
const items=[
{id:'a',title:'Agenda IA OpenAI',summary:'comparativa agentes',tags:['agenda'],status:'activo',type:'chat',priority:1,updatedAt:new Date().toISOString(),url:''},
{id:'b',title:'Agenda IA Hermes',summary:'comparativa agentes',tags:['agenda'],status:'activo',type:'work',priority:2,updatedAt:new Date().toISOString(),url:''}
];
assert(suggestRelations(items,0.2).length>=1);
assert.equal(dashboardStats(items).active,2);
console.log('OK: 5 grupos de pruebas superados');
