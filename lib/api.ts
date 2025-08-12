// Deepgram API integration for TTS
export async function deepgramTTS(text: string): Promise<Uint8Array | null> {
  const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    console.error('[deepgramTTS] No Deepgram API key found');
    return null;
  }

  try {
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-aries-en&encoding=linear16&container=wav&voice=aries', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('[deepgramTTS] API error:', response.status, response.statusText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('[deepgramTTS] Error:', error);
    return null;
  }
}