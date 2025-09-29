import { GeneratedImage } from '../types';

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

const OPENAI_COMPATIBLE_BASE_URL = (import.meta.env.VITE_OPENAI_COMPATIBLE_BASE_URL || '').replace(/\/$/, '');
const OPENAI_COMPATIBLE_API_KEY = import.meta.env.VITE_OPENAI_COMPATIBLE_API_KEY || '';
const OPENAI_COMPATIBLE_TEXT_MODEL = import.meta.env.VITE_OPENAI_COMPATIBLE_TEXT_MODEL || 'gpt-4o-mini';

const ensureOpenAIConfig = () => {
  if (!OPENAI_COMPATIBLE_BASE_URL) {
    throw new Error('OpenAI兼容API地址未配置。请在环境变量中设置 VITE_OPENAI_COMPATIBLE_BASE_URL。');
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

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.panels)) {
      throw new Error('invalid');
    }

    if (parsed.panels.length !== numberOfImages) {
      throw new Error(`OpenAI兼容API返回的分镜数量与预期不符（期望${numberOfImages}个）。`);
    }

    return parsed.panels;
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid') {
      throw new Error('OpenAI兼容API返回了无效的连环画分镜格式。');
    }
    throw new Error('解析OpenAI兼容API返回的连环画分镜时失败。');
  }
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

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.segments)) {
      throw new Error('invalid');
    }

    if (parsed.segments.length !== images.length) {
      throw new Error(`OpenAI兼容API返回的镜头脚本数量与预期不符（期望${images.length}个）。`);
    }

    return parsed.segments;
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid') {
      throw new Error('OpenAI兼容API返回了无效的镜头脚本格式。');
    }
    throw new Error('解析OpenAI兼容API返回的镜头脚本时失败。');
  }
};
