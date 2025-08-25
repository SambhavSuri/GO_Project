// Test script for the new Single API Call TTS approach
// This script can be run in the browser console to test the implementation

console.log('🧪 Testing Single API Call TTS Implementation');

// Test function to simulate the new flow
function testSingleAPICallFlow() {
    console.log('\n🚀 Starting Single API Call Test...');
    
    // Test 1: SentenceDetector in Collection Mode
    console.log('\n📝 Test 1: SentenceDetector Collection Mode');
    const testDetector = new SentenceDetector('collection');
    
    // Simulate streaming chunks
    const chunks = [
        'Hello, this is a test of the new single API call approach. ',
        'It should collect all the text instead of processing sentences individually. ',
        'This will result in better lip sync and more natural speech. ',
        'Let\'s see how well it works!'
    ];
    
    chunks.forEach((chunk, index) => {
        console.log(`📥 Adding chunk ${index + 1}: "${chunk}"`);
        const sentences = testDetector.addChunk(chunk);
        console.log(`   Returned sentences: ${sentences.length} (should be 0 in collection mode)`);
    });
    
    // Get collection stats
    const stats = testDetector.getCollectionStats();
    console.log('📊 Collection Stats:', stats);
    
    // Flush to get full text
    const fullText = testDetector.flush();
    console.log(`✅ Full collected text (${fullText ? fullText.length : 0} chars):`, fullText);
    
    // Test 2: TTSQueueManager in Single Call Mode
    console.log('\n🎤 Test 2: TTSQueueManager Single Call Mode');
    
    let ttsCallCount = 0;
    let lastTTSText = '';
    
    const testTTSManager = new TTSQueueManager(async (text) => {
        ttsCallCount++;
        lastTTSText = text;
        console.log(`🔊 TTS Call #${ttsCallCount}: Processing ${text.length} chars`);
        console.log(`   Text preview: "${text.substring(0, 100)}..."`);
        return new Promise(resolve => setTimeout(resolve, 100)); // Simulate async TTS
    }, 'single_call');
    
    // Simulate adding sentences (should collect, not process immediately)
    const testSentences = [
        'This is the first sentence.',
        'Here comes the second sentence.',
        'And finally the third sentence.'
    ];
    
    testSentences.forEach(sentence => {
        console.log(`📝 Adding sentence: "${sentence}"`);
        testTTSManager.addToQueue(sentence);
    });
    
    console.log(`📊 TTS Calls so far: ${ttsCallCount} (should be 0 - waiting for completion)`);
    
    // Mark response complete to trigger single call
    console.log('🏁 Marking response complete...');
    testTTSManager.markResponseComplete();
    
    // Wait a bit and check results
    setTimeout(() => {
        console.log(`\n✅ Final Results:`);
        console.log(`   Total TTS API calls: ${ttsCallCount} (should be 1)`);
        console.log(`   Last TTS text length: ${lastTTSText.length}`);
        console.log(`   Last TTS text: "${lastTTSText}"`);
        
        const collectionStats = testTTSManager.getCollectionStats();
        console.log('   Collection stats:', collectionStats);
        
        if (ttsCallCount === 1) {
            console.log('🎉 SUCCESS: Single API call approach working correctly!');
        } else {
            console.log('❌ FAIL: Expected 1 API call, got', ttsCallCount);
        }
    }, 200);
}

// Test function for comparing old vs new approach
function compareApproaches() {
    console.log('\n🔍 Comparing Old vs New Approaches...');
    
    const testText = 'This is sentence one. This is sentence two. This is sentence three.';
    
    // Old approach simulation
    console.log('\n📊 OLD APPROACH (Sequential):');
    const oldDetector = new SentenceDetector('streaming');
    let oldCallCount = 0;
    
    const oldTTSManager = new TTSQueueManager(async (text) => {
        oldCallCount++;
        console.log(`   Old API Call #${oldCallCount}: "${text}"`);
    }, 'sequential');
    
    const sentences = oldDetector.addChunk(testText);
    sentences.forEach(sentence => oldTTSManager.addToQueue(sentence));
    const remaining = oldDetector.flush();
    if (remaining) oldTTSManager.addToQueue(remaining);
    
    // New approach simulation
    console.log('\n📊 NEW APPROACH (Single Call):');
    const newDetector = new SentenceDetector('collection');
    let newCallCount = 0;
    
    const newTTSManager = new TTSQueueManager(async (text) => {
        newCallCount++;
        console.log(`   New API Call #${newCallCount}: "${text}"`);
    }, 'single_call');
    
    newDetector.addChunk(testText);
    const fullText = newDetector.flush();
    if (fullText) {
        newTTSManager.addToQueue(fullText);
        newTTSManager.markResponseComplete();
    }
    
    setTimeout(() => {
        console.log(`\n🏆 COMPARISON RESULTS:`);
        console.log(`   Old approach API calls: ${oldCallCount}`);
        console.log(`   New approach API calls: ${newCallCount}`);
        console.log(`   API call reduction: ${((oldCallCount - newCallCount) / oldCallCount * 100).toFixed(1)}%`);
    }, 300);
}

// Window testing functions
if (typeof window !== 'undefined') {
    window.testSingleAPICall = testSingleAPICallFlow;
    window.compareAPIApproaches = compareApproaches;
    
    console.log('🎮 Test functions available:');
    console.log('   window.testSingleAPICall() - Test the new single API call flow');
    console.log('   window.compareAPIApproaches() - Compare old vs new approaches');
}

// Auto-run tests if this script is executed directly
if (typeof module === 'undefined') {
    console.log('\n🔬 Running automatic tests...');
    testSingleAPICallFlow();
    setTimeout(() => compareApproaches(), 1000);
}
