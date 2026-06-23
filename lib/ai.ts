import { pipeline, env } from '@xenova/transformers';

// Configuration for server-side usage
env.allowLocalModels = false;
env.useBrowserCache = false;

// We use a small, fast model for zero-shot text classification
const MODEL_NAME = 'Xenova/nli-deberta-v3-small';

class PipelineSingleton {
  static task = 'zero-shot-classification';
  static model = MODEL_NAME;
  static instance: any = null;

  static async getInstance(progress_callback?: Function) {
    if (this.instance === null) {
      console.log(`[AI] Loading model ${this.model}... This will take a moment on first run.`);
      this.instance = await pipeline(this.task as any, this.model, { progress_callback });
      console.log(`[AI] Model loaded successfully!`);
    }
    return this.instance;
  }
}

export default PipelineSingleton;
