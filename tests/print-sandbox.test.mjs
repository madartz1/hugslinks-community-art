import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSandbox } from '../netlify/lib/print-sandbox.mjs';
const config={FINERWORKS_WEB_API_KEY:'test-web',FINERWORKS_APP_KEY:'test-app',FINERWORKS_TEST_SKU:'test-sku',HUGS_ART_PRINT_TEST_TOKEN:'private-admin-token'};
const ctx={deploy:{context:'deploy-preview'}};
const make=(body,token='private-admin-token')=>new Request('https://example.test/.netlify/functions/art-print-sandbox',{method:'POST',headers:{'x-hugs-print-test-token':token},body:JSON.stringify(body)});
const reply=data=>new Response(JSON.stringify(data),{status:200});
const dest={first_name:'Test',last_name:'Order',address_1:'1 Test Street',city:'New York',state_code:'NY',zip_postal_code:'10001'};
test('production and wrong token cannot access test route',async()=>{
 assert.equal((await handleSandbox(make({action:'product'}),{deploy:{context:'production'}},{env:config})).status,404);
 assert.equal((await handleSandbox(make({action:'product'},'incorrect'),ctx,{env:config})).status,401);
});
test('missing configuration fails closed',async()=>{
 const res=await handleSandbox(make({action:'product'}),ctx,{env:{HUGS_ART_PRINT_TEST_TOKEN:'private-admin-token'}});assert.equal(res.status,503);assert.equal((await res.json()).error,'test_configuration_incomplete');
});
test('shipping quote always uses server SKU and supplier test mode; supplier pricing and addresses do not leak',async()=>{
 let sent;
 const fetcher=async(url,options)=>{sent={url,...options};return reply({status:{success:true},orders:[{order_po:'HUGS-TEST-unique-test',options:[{id:17,rate:45.99,shipping_method:'Ground',calculated_total:{order_subtotal:201}}]}]})};
 const res=await handleSandbox(make({action:'shipping',recipient:dest,sku:'attacker-sku'}),ctx,{env:config,fetcher,uuid:()=> 'unique-test'});
 const sentBody=JSON.parse(sent.body);assert.equal(sentBody.orders[0].order_items[0].product_sku,'test-sku');assert.equal(sentBody.orders[0].test_mode,true);assert.ok(sent.url.endsWith('/list_shipping_options_multiple'));
 const result=await res.json();assert.deepEqual(result.options,[{id:'17',method:'Ground',rateCents:4599,currency:'USD',transitTime:null,automationReady:true}]);assert.doesNotMatch(JSON.stringify(result),/Test Street|201|test-sku|test-app/);
});
test('invalid addresses and unsupported actions do not call supplier',async()=>{
 const fetcher=async()=>{throw Error('must not call supplier')};
 assert.equal((await handleSandbox(make({action:'shipping',recipient:{...dest,state_code:'AK'}}),ctx,{env:config,fetcher})).status,400);
 assert.equal((await handleSandbox(make({action:'order',recipient:dest}),ctx,{env:config,fetcher})).status,400);
 assert.equal((await handleSandbox(make({action:'shipping',recipient:{...dest,first_name:5}}),ctx,{env:config,fetcher})).status,400);
});
test('supplier errors are categorized without exposing raw responses or keys',async()=>{
 const fetcher=async()=>new Response(JSON.stringify({status:{success:false,message:'secret test-app authentication error'}}),{status:403});
 const res=await handleSandbox(make({action:'product'}),ctx,{env:config,fetcher});assert.equal(res.status,502);const result=await res.json();assert.equal(result.error,'supplier_authentication_rejected');assert.doesNotMatch(JSON.stringify(result),/secret|test-app/);
});
