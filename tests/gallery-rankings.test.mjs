import test from 'node:test';
import assert from 'node:assert/strict';
import {rankGalleryWorks} from '../gallery-rankings.js';
test('server-published works without a publication flag remain visible with no false winners',()=>{const r=rankGalleryWorks([{id:'a',title:'Ascension'},{id:'b',title:'Stillwater'}],[]);assert.equal(r.items.length,2);assert.equal(r.hasVotes,false);assert.deepEqual(r.items.map(w=>w.rank),[null,null])});
test('equal recorded totals share a rank and zero votes have no rank',()=>{const r=rankGalleryWorks([{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}],[{id:'a',votes:3},{id:'b',votes:3},{id:'c',votes:0}]);assert.deepEqual(r.items.map(w=>w.rank),[1,1,null]);assert.equal(r.hasVotes,true)});
test('unpublished works and invalid scores cannot become ranking winners',()=>{const r=rankGalleryWorks([{id:'a',title:'A',published:false},{id:'b',title:'B'}],[{id:'a',votes:100},{id:'b',votes:'invalid'}]);assert.deepEqual(r.items.map(w=>w.id),['b']);assert.equal(r.hasVotes,false)});
