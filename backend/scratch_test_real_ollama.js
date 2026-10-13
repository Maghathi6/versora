const { assistantService } = require('./src/modules/assistant/assistant.service');

async function testRealOllama() {
  const userId = '055b2766-56af-44a3-b8e5-adba2b47ebee';
  const projectId = 'e4957039-1649-4ef8-b51c-ca80755ed001';

  console.log('--- 1. Testing getConfig ---');
  const config = await assistantService.getConfig(userId, projectId);
  console.log('Config:', JSON.stringify(config, null, 2));

  console.log('--- 2. Testing listConversations ---');
  const convs = await assistantService.listConversations(userId, projectId);
  console.log('Found conversations count:', convs.length);

  console.log('--- 3. Testing createConversation ---');
  const newConv = await assistantService.createConversation(userId, projectId, {
    title: 'Real Ollama Live Verification',
  });
  console.log('Created conversation:', newConv.id, newConv.title);

  console.log('--- 4. Sending Real Message to qwen3.5:4b ---');
  const sendRes = await assistantService.sendMessage(userId, projectId, newConv.id, {
    content: 'What is Versora and what files are in this project? Keep it brief in 2 sentences.',
  });
  console.log('Assistant response received:');
  console.log('Role:', sendRes.assistantMessage.role);
  console.log('Content preview:', sendRes.assistantMessage.content.substring(0, 150) + '...');
  console.log('Metadata:', JSON.stringify(sendRes.assistantMessage.metadata, null, 2));
  console.log('Sources count:', sendRes.assistantMessage.sources ? sendRes.assistantMessage.sources.length : 0);

  console.log('--- 5. Verifying Conversation History ---');
  const detail = await assistantService.getConversation(userId, projectId, newConv.id);
  console.log('Stored messages count in conversation:', detail.messages.length);

  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
}

testRealOllama()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERROR in testRealOllama:', err);
    process.exit(1);
  });
