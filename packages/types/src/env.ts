/**
 * Typed environment variables shared across apps and packages.
 * Read from process.env at startup in each process.
 */

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  appUrl: string;
  databaseUrl: string;
  s3: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
    publicUrl: string;
  };
  ffmpeg: {
    path: string;
    probePath: string;
    hwaccel: 'auto' | 'none' | 'nvenc' | 'qsv' | 'vaapi';
  };
  transcription?: {
    apiKey?: string;
    baseUrl: string;
    model: string;
  };
  audioPreprocessing?: boolean;
  localTranscription?: {
    python?: string; model: string; device: 'cpu' | 'cuda';
    alignment?: 'whisperx' | 'native';
    alignModelEn?: string; alignModelHi?: string;
  };
  llm?: {
    apiKey?: string;
    baseUrl: string;
    model: string;
  };
  ollama?: {
    baseUrl: string;
    model: string;
  };
  storageRoot?: string;
}

/** Minimal, throw-free accessor used at process boot. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return {
    nodeEnv: (source.NODE_ENV as Env['nodeEnv']) || 'development',
    appUrl: source.APP_URL || 'http://localhost:3000',
    databaseUrl:
      source.DATABASE_URL ||
      'file:./dev.db',
    s3: {
      endpoint: source.S3_ENDPOINT || 'http://localhost:9000',
      region: source.S3_REGION || 'us-east-1',
      accessKey: source.S3_ACCESS_KEY || 'clipx',
      secretKey: source.S3_SECRET_KEY || 'clipxsecret',
      bucket: source.S3_BUCKET || 'clipx',
      forcePathStyle: source.S3_FORCE_PATH_STYLE !== 'false',
      publicUrl: source.S3_PUBLIC_URL || 'http://localhost:9000/clipx',
    },
    ffmpeg: {
      path: source.FFMPEG_PATH || 'ffmpeg',
      probePath: source.FFPROBE_PATH || 'ffprobe',
      hwaccel: (source.FFMPEG_HWACCEL as Env['ffmpeg']['hwaccel']) || 'auto',
    },
    localTranscription: source.TRANSCRIPTION_PROVIDER === 'local' ? {
      python: source.LOCAL_TRANSCRIPTION_PYTHON || undefined,
      model: source.LOCAL_TRANSCRIPTION_MODEL || 'small',
      device: source.LOCAL_TRANSCRIPTION_DEVICE === 'cuda' ? 'cuda' : 'cpu',
      alignment: source.LOCAL_TRANSCRIPTION_ALIGNMENT === 'whisperx' ? 'whisperx' : 'native',
      alignModelEn: source.LOCAL_ALIGNMENT_MODEL_EN || undefined,
      alignModelHi: source.LOCAL_ALIGNMENT_MODEL_HI || undefined,
    } : undefined,
    audioPreprocessing: source.ASR_AUDIO_PREPROCESS !== 'false',
    transcription: source.TRANSCRIPTION_API_KEY
      ? {
          apiKey: source.TRANSCRIPTION_API_KEY,
          baseUrl: source.TRANSCRIPTION_BASE_URL || 'https://api.openai.com/v1',
          model: source.TRANSCRIPTION_MODEL || 'whisper-1',
        }
      : undefined,
    llm: source.AI_API_KEY
      ? {
          apiKey: source.AI_API_KEY,
          baseUrl: source.AI_BASE_URL || 'https://api.openai.com/v1',
          model: source.AI_MODEL || 'gpt-4o-mini',
        }
      : undefined,
    ollama: source.AI_PROVIDER === 'ollama'
      ? {
          baseUrl: source.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
          model: source.OLLAMA_MODEL || 'qwen3.5:9b',
        }
      : undefined,
    storageRoot: source.STORAGE_ROOT,
  };
}
