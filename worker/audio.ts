import { Env } from './index';
import { corsHeaders } from './lib/cors';
import { AwsV4Signer } from './lib/aws-signature';
import { AudioConfig, AWSRegion, Scene } from '../src/types/schema';

const nanoid = (size = 8) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => id + (byte & 63).toString(36), '');

interface AudioRequestBody {
  scene: Scene;
  projectId: string;
  audioConfig: AudioConfig;
  awsRegion: AWSRegion;
}

export async function handleAudioRequest(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
    const { method } = request;
    const { pathname } = url;

    try {
      if (method === 'POST' && pathname.endsWith('/generate')) {
        const body = await request.json() as AudioRequestBody;
        const { scene, projectId, audioConfig, awsRegion } = body;

        if (!scene || !projectId || !audioConfig) {
          return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing scene, projectId, or audioConfig' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const jobId = `aud_${Date.now()}_${nanoid()}`;
        const r2Key = `projects/${projectId}/scene_${scene.scene_id}/audio_${Date.now()}.mp3`;

        ctx.waitUntil(generateAudio(jobId, r2Key, body, env));

        return new Response(JSON.stringify({ jobId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (method === 'GET' && pathname.startsWith('/api/audio/status/')) {
        const jobId = pathname.split('/').pop();
        if (!jobId) {
          return new Response(JSON.stringify({ error: 'Bad Request', message: 'Missing job ID' }), { status: 400, headers: corsHeaders });
        }
        const jobStatus = await env.JOB_STATUS.get(jobId, { type: 'json' });
        if (!jobStatus) {
          return new Response(JSON.stringify({ error: 'Not Found', message: 'Job not found' }), { status: 404, headers: corsHeaders });
        }
        return new Response(JSON.stringify(jobStatus), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });

    } catch (e: any) {
      console.error('Audio Worker Error:', e);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), { status: 500, headers: corsHeaders });
    }
}

async function generateAudio(jobId: string, r2Key: string, body: AudioRequestBody, env: Env) {
  const { scene, audioConfig, awsRegion } = body;
  const model = audioConfig.preferred_model;

  await env.JOB_STATUS.put(jobId, JSON.stringify({ jobId, status: 'generating', model }), { expirationTtl: 3600 });

  try {
    let audioBuffer: ArrayBuffer;
    const text = audioConfig.language === 'id' ? scene.narrative_voiceover.text_id : scene.narrative_voiceover.text_en;

    switch (model) {
      case 'polly':
        audioBuffer = await generateWithPolly(scene, text, audioConfig, awsRegion, env);
        break;
      case 'gemini_tts':
        audioBuffer = await generateWithGeminiTTS(text, audioConfig, env);
        break;
      case 'elevenlabs':
        audioBuffer = await generateWithElevenLabs(text, audioConfig, env);
        break;
      default:
        throw new Error(`Unsupported audio model: ${model}`);
    }

    await env.STORY_STORAGE.put(r2Key, audioBuffer, { httpMetadata: { contentType: 'audio/mpeg' } });
    await env.JOB_STATUS.put(jobId, JSON.stringify({ jobId, status: 'done', r2Key, audioUrl: `/api/storage/presign?key=${r2Key}` }), { expirationTtl: 3600 });

  } catch (e: any) {
    console.error(`Failed to generate audio for job ${jobId}:`, e);
    await env.JOB_STATUS.put(jobId, JSON.stringify({ jobId, status: 'failed', error: e.message }), { expirationTtl: 3600 });
  }
}

function buildSSML(text: string, hints: Scene['narrative_voiceover']['ssml_hints'], speed: number) {
  let processedText = text;

  if (hints?.stress?.length) {
    hints.stress.forEach(word => {
      processedText = processedText.replace(new RegExp(`\\b${word}\\b`, 'g'), `<emphasis level="strong">${word}</emphasis>`);
    });
  }

  if (hints?.pause_after?.length) {
    hints.pause_after.forEach(phrase => {
      processedText = processedText.replace(phrase, `${phrase} <break time="350ms"/>`);
    });
  }

  const rate = Math.max(0.7, Math.min(1.3, speed)) * 100;
  return `<speak><prosody rate="${rate}%">${processedText}</prosody></speak>`;
}

async function generateWithPolly(scene: Scene, text: string, config: AudioConfig, region: AWSRegion, env: Env): Promise<ArrayBuffer> {
  const endpoint = `https://polly.${region}.amazonaws.com/v1/speech`;
  const ssml = buildSSML(text, scene.narrative_voiceover.ssml_hints, config.speed);

  const body = JSON.stringify({
    Engine: 'neural',
    LanguageCode: config.language === 'id' ? 'id-ID' : 'en-US',
    OutputFormat: 'mp3',
    Text: ssml,
    TextType: 'ssml',
    VoiceId: config.voice_character,
  });

  const signer = new AwsV4Signer({ awsAccessKeyId: env.AWS_ACCESS_KEY_ID, awsSecretKey: env.AWS_SECRET_ACCESS_KEY }, region, 'polly');
  const request = new Request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const signedRequest = await signer.sign(request);
  const response = await fetch(signedRequest);

  if (!response.ok) {
    throw new Error(`Polly API error: ${await response.text()}`);
  }
  return response.arrayBuffer();
}

async function generateWithGeminiTTS(text: string, config: AudioConfig, env: Env): Promise<ArrayBuffer> {
    const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GEMINI_API_KEY}`;
    const body = JSON.stringify({
        input: { text },
        voice: { languageCode: config.language === 'id' ? 'id-ID' : 'en-US', name: config.voice_character },
        audioConfig: { audioEncoding: 'MP3', speakingRate: config.speed }
    });
    
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

    if (!response.ok) {
        throw new Error(`Gemini TTS API error: ${await response.text()}`);
    }
    const data = await response.json() as { audioContent: string };
    const byteString = atob(data.audioContent);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return ab;
}

async function generateWithElevenLabs(text: string, config: AudioConfig, env: Env): Promise<ArrayBuffer> {
    if (!env.ELEVENLABS_API_KEY) {
        throw new Error('ElevenLabs API key is not configured.');
    }
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${config.voice_character}`;
    const body = JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
            stability: 0.7,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
        }
    });

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': env.ELEVENLABS_API_KEY
        },
        body: body,
    });

    if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${await response.text()}`);
    }
    return response.arrayBuffer();
}
