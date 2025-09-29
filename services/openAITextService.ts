import { AspectRatio, CameraMovement, GeneratedImage, InspirationStrength } from '../types';

interface ChatMessageContentPart {
  type: 'text' | 'input_text' | 'input_image';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
}

interface ChatCompletionChoice {
  message?: {
    content?: string | ChatMessageContentPart[];
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

const getEnvValue = (...keys: string[]): string | undefined => {
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env;
  const processEnv = typeof process !== 'undefined' ? process.env : undefined;

  for (const key of keys) {
    const value = importMetaEnv?.[key] ?? processEnv?.[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
};

const rawBaseUrl = getEnvValue(
  'VITE_OPENAI_COMPATIBLE_BASE_URL',
  'VITE_OPENAI_COMPATIBLE_API_BASE_URL',
  'VITE_OPENAI_COMPATIBLE_BASEURL',
);
const OPENAI_COMPATIBLE_BASE_URL = (rawBaseUrl || '').replace(/\/$/, '');
const OPENAI_COMPATIBLE_API_KEY = getEnvValue(
  'VITE_OPENAI_COMPATIBLE_API_KEY',
  'VITE_OPENAI_COMPATIBLE_KEY',
  'OPENAI_COMPATIBLE_API_KEY',
) || '';
const OPENAI_COMPATIBLE_TEXT_MODEL = getEnvValue(
  'VITE_OPENAI_COMPATIBLE_TEXT_MODEL',
  'VITE_OPENAI_COMPATIBLE_API_MODEL',
  'VITE_OPENAI_COMPATIBLE_MODEL',
) || 'gpt-4o-mini';

const ensureOpenAIConfig = () => {
  if (!OPENAI_COMPATIBLE_BASE_URL) {
    throw new Error('OpenAI兼容API地址未配置。请在环境变量中设置 VITE_OPENAI_COMPATIBLE_BASE_URL 或 VITE_OPENAI_COMPATIBLE_API_BASE_URL。');
  }
  if (!OPENAI_COMPATIBLE_API_KEY) {
    throw new Error('OpenAI兼容API密钥未配置。请在环境变量中设置 VITE_OPENAI_COMPATIBLE_API_KEY。');
  }
};

const extractMessageContent = (content: string | ChatMessageContentPart[] | undefined): string => {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content.trim();
  }

  return content
    .map((part) => {
      if (part.type === 'text' || part.type === 'input_text') {
        return part.text || '';
      }
      return '';
    })
    .join('')
    .trim();
};

const sanitizeJsonLikeContent = (raw: string): string => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('```')) {
    const lines = trimmed.split('\n');
    const codeFenceCloseIndex = lines.findIndex((line, index) => index !== 0 && line.trim() === '```');
    if (codeFenceCloseIndex !== -1) {
      return lines.slice(1, codeFenceCloseIndex).join('\n').trim();
    }
    return lines.slice(1).join('\n').trim();
  }

  return trimmed;
};

const parseJsonContent = <T>(raw: string, context: string): T => {
  const sanitized = sanitizeJsonLikeContent(raw);

  if (!sanitized) {
    throw new Error(`${context}：OpenAI兼容API未返回任何内容。`);
  }

  try {
    return JSON.parse(sanitized) as T;
  } catch (error) {
    console.error('Failed to parse JSON response from OpenAI compatible API:', {
      context,
      raw,
      error,
    });
    throw new Error(`${context}：解析OpenAI兼容API返回的JSON失败。`);
  }
};

const callOpenAIChat = async (body: Record<string, unknown>): Promise<ChatCompletionResponse> => {
  ensureOpenAIConfig();

  try {
    const response = await fetch(`${OPENAI_COMPATIBLE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_COMPATIBLE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (typeof errorData?.error?.message === 'string') {
          message = errorData.error.message;
        }
      } catch {
        const text = await response.text();
        if (text) {
          message = text;
        }
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(`OpenAI兼容API鉴权失败：${message}`);
      }
      throw new Error(`调用OpenAI兼容API失败：${message}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('调用OpenAI兼容API时发生未知错误。');
  }
};

export const generateComicPanelPrompts = async (
  story: string,
  stylePrompt: string,
  numberOfImages: number,
): Promise<string[]> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'comic_panel_prompts',
        schema: {
          type: 'object',
          properties: {
            panels: {
              type: 'array',
              minItems: numberOfImages,
              maxItems: numberOfImages,
              items: {
                type: 'string',
                description: 'Detailed visual prompt for a single comic panel',
              },
            },
          },
          required: ['panels'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a master story book prompter that breaks a story into detailed, visually rich prompts for image generation.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**任务:** 将下面的故事拆解为${numberOfImages}个连贯的画面描述，以便用于生成连环画。`,
          },
          {
            type: 'text',
            text: `**故事内容:**\n${story}`,
          },
          {
            type: 'text',
            text: `**风格要求:** ${stylePrompt}`,
          },
          {
            type: 'text',
            text: `**输出要求:**\n1. 严格生成${numberOfImages}条描述。\n2. 每条描述必须是可直接用于图像生成的提示词，包含角色、动作、场景、氛围等细节。\n3. 使用中文或英文均可，但需保持统一。\n4. 保持所有画面在角色和场景上的一致性。\n5. 以JSON对象返回，字段名为"panels"，对应一个数组，数组元素为每个画面的提示词。`,
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何连环画分镜描述。');
  }

  const parsed = parseJsonContent<{ panels: unknown }>(content, '生成连环画分镜');

  if (!Array.isArray(parsed?.panels)) {
    throw new Error('OpenAI兼容API返回了无效的连环画分镜格式。');
  }

  if (parsed.panels.length !== numberOfImages) {
    throw new Error(`OpenAI兼容API返回的分镜数量与预期不符（期望${numberOfImages}个）。`);
  }

  return parsed.panels as string[];
};

export const generateVideoStoryboard = async (
  story: string,
  images: GeneratedImage[],
): Promise<Array<{ cameraMovement: string; shotType: string; actionDescription: string; emotionalTone: string }>> => {
  if (images.length === 0) {
    return [];
  }

  const imageContents: ChatMessageContentPart[] = images.map((image) => ({
    type: 'input_image',
    image_url: { url: image.src },
  }));

  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'video_storyboard_segments',
        schema: {
          type: 'object',
          properties: {
            segments: {
              type: 'array',
              minItems: images.length,
              maxItems: images.length,
              items: {
                type: 'object',
                properties: {
                  cameraMovement: { type: 'string' },
                  shotType: { type: 'string' },
                  actionDescription: { type: 'string' },
                  emotionalTone: { type: 'string' },
                },
                required: ['cameraMovement', 'shotType', 'actionDescription', 'emotionalTone'],
                additionalProperties: false,
              },
            },
          },
          required: ['segments'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are an award-winning film director who creates vivid storyboard instructions for animators.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**整体故事:** ${story}`,
          },
          {
            type: 'text',
            text: `**任务:** 针对提供的每张连环画图片，输出一个详尽的镜头脚本描述。需要包含摄影机运镜、景别、核心动作与情绪。输出数量需与图片数量一致（${images.length}条）。`,
          },
          {
            type: 'text',
            text: '**输出格式:** 以JSON对象返回，字段名为"segments"，对应一个数组，数组中每个元素包含 cameraMovement、shotType、actionDescription、emotionalTone 四个字段。',
          },
          ...imageContents,
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何镜头脚本。');
  }

  const parsed = parseJsonContent<{ segments: unknown }>(content, '生成镜头脚本');

  if (!Array.isArray(parsed?.segments)) {
    throw new Error('OpenAI兼容API返回了无效的镜头脚本格式。');
  }

  if (parsed.segments.length !== images.length) {
    console.warn(`OpenAI兼容API返回的镜头脚本数量 (${parsed.segments.length}) 与图片数量 (${images.length}) 不一致，将进行裁剪或填充。`);
  }

  return parsed.segments as Array<{ cameraMovement: string; shotType: string; actionDescription: string; emotionalTone: string }>;
};

export const generateWikiCardPrompts = async (
  topic: string,
  stylePrompt: string,
  numberOfCards: number,
): Promise<string[]> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'illustrated_wiki_cards',
        schema: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              minItems: numberOfCards,
              maxItems: numberOfCards,
              items: {
                type: 'string',
                description: 'A detailed 16:9 educational illustration prompt',
              },
            },
          },
          required: ['cards'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are an instructional designer who writes concise, vivid prompts for educational infographic images.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**任务:** 围绕主题“${topic}”生成${numberOfCards}条用于 Imagen 风格图解卡片的提示词。`,
          },
          {
            type: 'text',
            text: `**风格要求:** ${stylePrompt}`,
          },
          {
            type: 'text',
            text: `**画面约束:** 每条提示词都必须明确 16:9 画幅、适合在单张图片内呈现、包含可读性良好的英文文字标签和解释要点。`,
          },
          {
            type: 'text',
            text: '**输出格式:** 以 JSON 对象返回，字段名为 "cards"，其中包含每张卡片的完整提示词。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何图解卡片描述。');
  }

  const parsed = parseJsonContent<{ cards: unknown }>(content, '生成图解卡片提示');

  if (!Array.isArray(parsed?.cards)) {
    throw new Error('OpenAI兼容API返回了无效的图解卡片格式。');
  }

  if (parsed.cards.length !== numberOfCards) {
    throw new Error(`OpenAI兼容API返回的卡片数量与预期不符（期望${numberOfCards}个）。`);
  }

  return parsed.cards as string[];
};

export const generateTextToImagePrompt = async (
  basePrompt: string,
  selectedKeywords: string[],
  aspectRatio: AspectRatio,
  numberOfImages: number,
  negativePrompt?: string,
): Promise<{ positivePrompt: string; negativePrompt?: string }> => {
  const keywordsText = selectedKeywords.length > 0 ? selectedKeywords.join(', ') : '无';

  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.5,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'text_to_image_prompt',
        schema: {
          type: 'object',
          properties: {
            positivePrompt: {
              type: 'string',
              description: 'The final detailed prompt for generating an image',
            },
            negativePrompt: {
              type: 'string',
              description: 'Optional negative prompt to avoid unwanted elements',
            },
          },
          required: ['positivePrompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a professional image prompt engineer who optimises user ideas into rich, structured prompts for high-end diffusion models.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**用户主提示:** ${basePrompt || '（空）'}`,
          },
          {
            type: 'text',
            text: `**用户选择的关键词:** ${keywordsText}`,
          },
          {
            type: 'text',
            text: `**目标画幅比例:** ${aspectRatio}，**需要生成的图片数量:** ${numberOfImages} 张。`,
          },
          {
            type: 'text',
            text: `**负面提示:** ${negativePrompt && negativePrompt.trim() ? negativePrompt : '无'}`,
          },
          {
            type: 'text',
            text: '请整合上述信息，输出一个高度具体、条理分明且适合直接用于 Imagen 的英文提示词，必要时可加入合理的构图、光线和镜头描述。若需要，可生成改进后的负面提示。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何文生图提示词。');
  }

  const parsed = parseJsonContent<{
    positivePrompt?: unknown;
    negativePrompt?: unknown;
  }>(content, '生成文生图提示词');

  if (typeof parsed?.positivePrompt !== 'string' || !parsed.positivePrompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的文生图提示词格式。');
  }

  const result: { positivePrompt: string; negativePrompt?: string } = {
    positivePrompt: parsed.positivePrompt.trim(),
  };

  if (typeof parsed.negativePrompt === 'string' && parsed.negativePrompt.trim()) {
    result.negativePrompt = parsed.negativePrompt.trim();
  }

  return result;
};

export const generateImageEditPrompt = async (prompt: string): Promise<string> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'image_edit_prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You translate user editing requests into precise instructions for generative image models.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `根据以下编辑需求，生成用于 Gemini 图像编辑的英文提示词：\n${prompt}`,
          },
          {
            type: 'text',
            text: '提示词需明确主体、要修改或新增的元素、光线、氛围等细节，避免含糊表达。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何图像编辑提示词。');
  }

  const parsed = parseJsonContent<{ prompt?: unknown }>(content, '生成图像编辑提示词');

  if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的图像编辑提示词格式。');
  }

  return parsed.prompt.trim();
};

const inspirationStrengthMap: Record<InspirationStrength, string> = {
  low: '轻度借鉴风格，主要保持新主题的独特性',
  medium: '明显借鉴风格，兼顾新主题与参考图的氛围',
  high: '严格遵循参考图风格，仅替换为新主题',
  veryHigh: '最大化复刻参考图的整体风格与质感',
};

export const generateStyleInspirationPrompt = async (
  newPrompt: string,
  strength: InspirationStrength,
): Promise<string> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'style_inspiration_prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You craft prompts that transfer the artistic style of a reference image onto a new subject.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**新主题描述:** ${newPrompt}`,
          },
          {
            type: 'text',
            text: `**风格借鉴强度:** ${inspirationStrengthMap[strength]}`,
          },
          {
            type: 'text',
            text: '请输出一段英文提示词，强调延续参考图的色彩、光线、材质和氛围，同时突出新主题。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何风格借鉴提示词。');
  }

  const parsed = parseJsonContent<{ prompt?: unknown }>(content, '生成风格借鉴提示词');

  if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的风格借鉴提示词格式。');
  }

  return parsed.prompt.trim();
};

export const generateInpaintingPrompt = async (prompt: string): Promise<string> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'inpainting_prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You describe precise replacement content for masked regions in images.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请根据以下描述生成英文提示词，用于替换图像蒙版区域：\n${prompt}`,
          },
          {
            type: 'text',
            text: '描述需包含主体、细节、光线与风格，确保能与原图自然融合。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何局部重绘提示词。');
  }

  const parsed = parseJsonContent<{ prompt?: unknown }>(content, '生成局部重绘提示词');

  if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的局部重绘提示词格式。');
  }

  return parsed.prompt.trim();
};

export const generateVideoPrompt = async (
  prompt: string,
  cameraMovement: CameraMovement,
): Promise<string> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.5,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'video_prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You create cinematic prompts for short AI-generated videos.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**镜头描述:** ${prompt}`,
          },
          {
            type: 'text',
            text: `**运镜方式:** ${cameraMovement}`,
          },
          {
            type: 'text',
            text: '请输出一段英文提示词，包含场景、主体、动作、光线、镜头节奏，并融入指定的运镜方式描述。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何视频生成提示词。');
  }

  const parsed = parseJsonContent<{ prompt?: unknown }>(content, '生成视频提示词');

  if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的视频提示词格式。');
  }

  return parsed.prompt.trim();
};

export const generateVideoTransitionPrompt = async (
  nextSceneScript: string,
  storyContext: string,
  stylePrompt: string,
): Promise<string> => {
  const body = {
    model: OPENAI_COMPATIBLE_TEXT_MODEL,
    temperature: 0.5,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'video_transition_prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
          required: ['prompt'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You design cinematic transition prompts that bridge two scenes seamlessly.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `**整体故事:** ${storyContext}`,
          },
          {
            type: 'text',
            text: `**下一场景描述:** ${nextSceneScript}`,
          },
          {
            type: 'text',
            text: `**艺术风格约束:** ${stylePrompt}`,
          },
          {
            type: 'text',
            text: '请输出一个英文提示词，描述视频从当前静帧平滑过渡到下一场景的短片段，强调氛围、光线和镜头语言。',
          },
        ],
      },
    ] satisfies ChatMessage[],
  };

  const completion = await callOpenAIChat(body);
  const content = extractMessageContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error('OpenAI兼容API未返回任何转场提示词。');
  }

  const parsed = parseJsonContent<{ prompt?: unknown }>(content, '生成视频转场提示词');

  if (typeof parsed?.prompt !== 'string' || !parsed.prompt.trim()) {
    throw new Error('OpenAI兼容API返回了无效的转场提示词格式。');
  }

  return parsed.prompt.trim();
};
