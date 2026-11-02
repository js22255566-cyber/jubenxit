import {spawnSync} from 'node:child_process';
const tests=['test-bai-routing.mjs','test-bai-ui-vm.mjs','test-single-api.mjs','test-configuration-api.mjs','test-sync.mjs','test-partitions.mjs','test-documents.mjs','test-ai-translation-style.mjs','test-chat-navigation-vm.mjs','test-chat-search-vm.mjs','test-copy-pending-vm.mjs','test-copy-selection-navigation.mjs','test-outbox-ack-vm.mjs','test-ws-queue-vm.mjs','test-ws-receipt-recovery.mjs','test-ws-editor-text.mjs','test-ws-extension.mjs'];
for(const test of tests){const result=spawnSync(process.execPath,['scripts/'+test],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
console.log('PASS '+tests.length+' isolated regression suites; no browser or real customer network actions.');
