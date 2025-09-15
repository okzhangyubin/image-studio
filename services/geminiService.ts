// services/geminiService.ts

import { GoogleGenAI, Modality, GenerateImagesConfig, Type } from "@google/genai";
import { ImageStyle, CameraMovement, ImageModel, AspectRatio, InspirationStrength, GeneratedImage } from '../types';

const stylePrompts = {
  [ImageStyle.ILLUSTRATION]: "A modern flat illustration style. Use simple shapes, bold colors, and clean lines. Avoid gradients and complex textures. The characters and objects should be stylized and minimalist. Maintain consistency in this flat illustration style.",
  [ImageStyle.CLAY]: "A charming and tactile claymation style. All objects and characters should appear as if they are sculpted from modeling clay, with visible textures like fingerprints and tool marks. Use a vibrant, saturated color palette and soft, dimensional lighting to enhance the handmade feel. Maintain consistency in this claymation style.",
  [ImageStyle.DOODLE]: "A playful and charming hand-drawn doodle style. Use thick, colorful pencil-like strokes, whimsical characters, and a scrapbook-like feel. The overall mood should be friendly and approachable. Maintain consistency in this doodle style.",
  [ImageStyle.CARTOON]: "A super cute and adorable 'kawaii' cartoon style. Characters should have large, expressive eyes, rounded bodies, and simple features. Use a soft, pastel color palette with clean, bold outlines. The overall mood should be sweet, charming, and heartwarming, like illustrations for a children's storybook. Maintain consistency in this cute cartoon style.",
  [ImageStyle.INK_WASH]: "A rich and expressive Chinese ink wash painting style (Shuǐ-mò huà). Use varied brushstrokes, from delicate lines to broad washes. Emphasize atmosphere, negative space (留白), and the flow of 'qi' (气韵). The palette should be primarily monochrome with occasional subtle color accents. Maintain consistency in this ink wash style.",
  [ImageStyle.AMERICAN_COMIC]: "A classic American comic book style. Use bold, dynamic outlines, dramatic shading with techniques like cross-hatching and ink spotting. The colors should be vibrant but with a slightly gritty, printed texture. Focus on heroic poses, action, and expressive faces. Maintain consistency in this American comic style.",
  [ImageStyle.WATERCOLOR]: "A delicate and translucent watercolor painting style. Use soft, blended washes of color with visible paper texture. The edges should be soft and sometimes bleed into each other. The overall mood should be light, airy, and artistic. Maintain consistency in this watercolor style.",
  [ImageStyle.PHOTOREALISTIC]: "A photorealistic style. Emphasize realistic lighting, textures, and details to make the image look like a high-resolution photograph. Use natural color grading and depth of field. Maintain consistency in this photorealistic style.",
  [ImageStyle.JAPANESE_MANGA]: "A classic black-and-white Japanese manga style. Use sharp, clean lines, screentones for shading, and expressive characters with large eyes. Focus on dynamic action lines and paneling aesthetics. Maintain consistency in this manga style.",
  [ImageStyle.THREE_D_ANIMATION]: "A vibrant and polished 3D animation style, similar to modern animated feature films. Characters and objects should have smooth, rounded surfaces, and the scene should feature dynamic lighting, shadows, and a sense of depth. The overall mood should be charming and visually rich. Maintain consistency in this 3D animation style."
};

const handleApiError = (error: unknown): Error => {
  console.error("Error calling Gemini API:", error);
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key not valid') || message.includes('api_key_invalid')) {
      return new Error("您提供的API密钥无效或不正确。请检查后重试。");
    }
    
    if (message.includes('resource_exhausted') || message.includes('rate limit') || message.includes('quota')) {
      return new Error("您的API Key配额已用尽或已达到速率限制。请检查您的Google AI Studio配额或稍后再试。");
    }
    
    if (message.includes('safety') || message.includes('blocked')) {
      return new Error("生成的内容可能违反了安全政策而被阻止。请尝试调整您的提示词。");
    }
    
    if (message.includes('invalid_argument')) {
      return new Error("您的输入无效。请检查您的提示词或上传的图片后重试，也可能是此模型需要搭配付费KEY。");
    }
  }
  
  return new Error("生成失败。请稍后重试或检查您的网络连接。");
};

const base64ToGenerativePart = (base64Data: string): {inlineData: {data: string, mimeType: string}} => {
    const [header, data] = base64Data.split(',');
    if (!data) {
        // Handle cases where the base64 string might not have a header
        const bstr = atob(header);
        let mimeType = 'image/png'; // default
        // A simple check for JPEG, not foolproof
        if (bstr.charCodeAt(0) === 0xFF && bstr.charCodeAt(1) === 0xD8) {
            mimeType = 'image/jpeg';
        }
        return {
            inlineData: {
                data: header,
                mimeType,
            }
        };
    }
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
    return {
        inlineData: {
            data,
            mimeType,
        }
    };
};

export const generateIllustratedCards = async (prompt: string, style: ImageStyle, model: ImageModel, apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API Key is required to generate images.");
  }
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (model === ImageModel.NANO_BANANA) {
      const fullPrompt = `
        **Primary Goal:** Generate a set of exactly 4 distinct, separate educational infographic images to explain the concept of: "${prompt}".

        **CRITICAL REQUIREMENTS FOR ALL 4 IMAGES:**
        1.  **Quantity:** You MUST generate exactly FOUR separate images. Do not generate a single composite image.
        2.  **Aspect Ratio:** Each of the four images MUST be in a 16:9 widescreen aspect ratio.
        3.  **Style:** Adhere strictly to the following style: ${stylePrompts[style]}. Use a solid, simple background color for all images to ensure the main content stands out.
        4.  **Text:** All text must be in clear, concise, and readable English. No Chinese characters. Use text to label key elements and provide brief explanations.
        5.  **Consistency:** Maintain a unified color palette and artistic style across all 4 images, so they look like a cohesive series.
        6.  **Content Progression:** Each image should logically build upon the previous one. They should illustrate different key aspects or steps of the concept, forming a clear, step-by-step visual narrative from the first image to the last.
      `;
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const images: string[] = [];
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType;
            images.push(`data:${mimeType};base64,${part.inlineData.data}`);
          }
        }
      }
      if (images.length > 0) return images.slice(0, 4);

    } else if (model === ImageModel.IMAGEN) {
      const fullPrompt = `An educational infographic in a 16:9 widescreen aspect ratio. The image should visually explain the concept of "${prompt}". Art Style: ${stylePrompts[style]}. The image must contain clear, concise, and readable English text to label key elements and provide brief explanations. No Chinese characters.`;
      const response = await ai.models.generateImages({
        model: model,
        prompt: fullPrompt,
        config: {
          numberOfImages: 4,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
      }
    }

    throw new Error("AI未能生成任何图片。请尝试更换您的问题或风格。");

  } catch (error) {
    throw handleApiError(error);
  }
};

export const generateComicStrip = async (story: string, style: ImageStyle, apiKey: string, numberOfImages: number): Promise<{ imageUrls: string[], panelPrompts: string[] }> => {
    if (!apiKey) {
        throw new Error("API Key is required to generate images.");
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        // Step 1: Generate detailed prompts for each panel using a text model
        const promptGenerationResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `
                        **Task:** You are a master story book prompter. Your goal is to break down a story into a series of detailed, visually descriptive prompts for an image generation AI.

                        **User's Story Idea:**
                        ---
                        ${story}
                        ---

                        **CRITICAL INSTRUCTIONS:**
                        1.  **Generate Prompts:** Create exactly ${numberOfImages} distinct prompts, one for each panel of the story strip.
                        2.  **Visual Detail:** Each prompt must be a rich, detailed visual description. Describe characters, actions, setting, mood, and composition.
                        3.  **Style Integration:** Each prompt MUST explicitly include and adhere to this art style: "${stylePrompts[style]}".
                        4.  **Consistency:** Ensure prompts are written to maintain character and scene consistency across the panels. For example, if a character is "a young boy with red hair", he should be described that way in all relevant prompts.
                        5.  **Format:** You MUST return a JSON array containing exactly ${numberOfImages} strings. Do not include any other text or formatting.
                    `
                }]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: 'A detailed visual prompt for a single story book panel.'
                    }
                }
            }
        });

        const jsonStr = promptGenerationResponse.text.trim();
        const panelPrompts = JSON.parse(jsonStr);

        if (!Array.isArray(panelPrompts) || panelPrompts.length !== numberOfImages) {
            throw new Error(`AI failed to generate the correct number of prompts. Expected ${numberOfImages}, got ${panelPrompts.length}.`);
        }

        // Step 2: Generate an image for each prompt using Imagen
        const imageGenerationPromises = panelPrompts.map(panelPrompt => {
            return ai.models.generateImages({
                model: ImageModel.IMAGEN,
                prompt: panelPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '16:9',
                },
            });
        });

        const imageResponses = await Promise.all(imageGenerationPromises);

        const images: string[] = imageResponses.map(response => {
            if (response.generatedImages && response.generatedImages.length > 0) {
                return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
            }
            // Throw an error or return a placeholder if a panel fails
            throw new Error("One or more story panels failed to generate.");
        });

        if (images.length > 0) {
            return { imageUrls: images, panelPrompts };
        }

        throw new Error("AI failed to generate any story panels. Please check your story or try another style.");

    } catch (error) {
        throw handleApiError(error);
    }
};

export const editComicPanel = async (originalImageBase64: string, prompt: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("API Key is required to edit images.");
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
        const imagePart = base64ToGenerativePart(originalImageBase64);
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: ImageModel.NANO_BANANA,
            contents: {
                parts: [imagePart, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        const imagePartResponse = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);

        if (imagePartResponse?.inlineData) {
            return `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
        }

        throw new Error("AI未能编辑图片。请尝试更换您的提示词。");

    } catch (error) {
        throw handleApiError(error);
    }
};


export const generateVideoScriptsForComicStrip = async (story: string, images: GeneratedImage[], apiKey: string): Promise<string[]> => {
    if (!apiKey) {
      throw new Error("API Key is required to generate video scripts.");
    }
    const ai = new GoogleGenAI({ apiKey });
  
    try {
        const imageParts = images.map(img => base64ToGenerativePart(img.src));
        
        const textPart = { text: `
            **任务:** 你是一位专业的电影导演，你的目标是为一部连环画创作详细的视频分镜脚本。
            **整体故事:** "${story}"

            **指令:**
            1.  分析所提供的图像序列。
            2.  为每一张图片，生成一个详细的、包含丰富镜头语言的单句视频提示词（中文）。
            3.  每个提示词必须包含摄影机运镜、景别、核心动作和情感基调。
            4.  动作描述应生动具体，描述画面中正在发生或暗示的动作，而不是静态地描述图片。
            5.  你必须返回一个包含 ${images.length} 个对象的JSON数组，严格遵守指定的 schema。
        ` };

        const allParts = [textPart, ...imageParts];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: allParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            cameraMovement: { 
                                type: Type.STRING,
                                description: "电影化的摄影机运镜。例如：'缓慢推镜'、'固定镜头'、'向左摇镜'、'升降镜头下降'。"
                            },
                            shotType: {
                                type: Type.STRING,
                                description: "景别和机位角度。例如：'特写镜头'、'远景镜头'、'低角度镜头'。"
                            },
                            actionDescription: {
                                type: Type.STRING,
                                description: "生动描述核心动作的单句话。"
                            },
                            emotionalTone: {
                                type: Type.STRING,
                                description: "场景要传达的情绪。例如：'紧张悬疑'、'欢乐活泼'、'平静忧郁'。"
                            }
                        },
                        required: ["cameraMovement", "shotType", "actionDescription", "emotionalTone"],
                    },
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        if (!Array.isArray(result) || result.some(item => typeof item.actionDescription !== 'string')) {
            throw new Error("AI returned an invalid script format.");
        }
        
        const scripts = result.map((item: {cameraMovement: string, shotType: string, actionDescription: string, emotionalTone: string}) => {
            return `${item.cameraMovement}的${item.shotType}，${item.actionDescription}画面充满${item.emotionalTone}的氛围。`;
        });


        if (scripts.length !== images.length) {
            console.warn(`AI returned ${scripts.length} scripts, but expected ${images.length}. Truncating/padding.`);
            // Adjust the array size to match the number of images
            const adjustedScripts = new Array(images.length).fill('');
            for (let i = 0; i < Math.min(scripts.length, images.length); i++) {
                adjustedScripts[i] = scripts[i];
            }
            return adjustedScripts;
        }

        return scripts;

    } catch (error) {
        throw handleApiError(error);
    }
};


export const generateTextToImage = async (prompt: string, negativePrompt: string, apiKey: string, numberOfImages: number, aspectRatio: AspectRatio): Promise<string[]> => {
    if (!apiKey) {
      throw new Error("API Key is required to generate images.");
    }
    const ai = new GoogleGenAI({ apiKey });
  
    try {
      const config: GenerateImagesConfig = {
        numberOfImages: numberOfImages,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio,
      };

      if (negativePrompt && negativePrompt.trim()) {
        config.negativePrompt = negativePrompt.trim();
      }

      const response = await ai.models.generateImages({
        model: ImageModel.IMAGEN,
        prompt: prompt,
        config: config,
      });
  
      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
      }
  
      throw new Error("AI未能生成任何图片。请尝试更换您的提示词。");
    } catch (error) {
      throw handleApiError(error);
    }
};

const fileToGenerativePart = (file: File): Promise<{inlineData: {data: string, mimeType: string}}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      if (base64Data) {
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      } else {
        reject(new Error("Failed to read file data."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const generateFromImageAndPrompt = async (prompt: string, files: File[], apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API Key is required to generate images.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash-image-preview';

  try {
    const imageParts = await Promise.all(files.map(fileToGenerativePart));

    const allParts = [
      ...imageParts,
      { text: `Based on the provided image(s), generate exactly 1 distinct image from the following prompt: "${prompt}"` },
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: allParts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const images: string[] = [];
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        }
      }
    }

    if (images.length === 0) {
      throw new Error("AI未能生成任何图片。请尝试更换您的提示词或图片。");
    }

    return images.slice(0, 1);
  } catch (error) {
    throw handleApiError(error);
  }
};

export const generateWithStyleInspiration = async (
  referenceImageFile: File,
  newPrompt: string,
  apiKey: string,
  strength: InspirationStrength
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API Key is required to generate images.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash-image-preview';

  try {
    const imagePart = await fileToGenerativePart(referenceImageFile);

    const strengthPrompts: Record<InspirationStrength, string> = {
      low: `Subtly inspired by the artistic style, color palette, and overall mood from the provided image, generate exactly 1 new distinct image depicting the following subject: "${newPrompt}". Do not replicate the subject of the reference image. The new subject should be the primary focus.`,
      medium: `Strictly using the artistic style, color palette, and overall mood from the provided image as a reference, generate exactly 1 new distinct image depicting the following subject: "${newPrompt}". Do not replicate the subject of the reference image.`,
      high: `Strictly and heavily adhere to the artistic style, color palette, texture, and overall mood from the provided image. Use it as a strong style template to generate exactly 1 new distinct image depicting: "${newPrompt}". Do not replicate the subject of the reference image.`,
      veryHigh: `Replicate the provided image's artistic style, color palette, texture, and overall mood almost identically. Use it as an exact style template to generate exactly 1 new distinct image depicting: "${newPrompt}". The new image should look as if it was created by the same artist. Do not replicate the subject of the reference image.`
    };

    const textPart = {
      text: strengthPrompts[strength]
    };

    const allParts = [imagePart, textPart];

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: allParts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const images: string[] = [];
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        }
      }
    }

    if (images.length === 0) {
      throw new Error("AI未能生成任何图片。请尝试更换您的提示词或参考图。");
    }

    return images.slice(0, 1);
  } catch (error) {
    throw handleApiError(error);
  }
};


export const generateInpainting = async (prompt: string, originalImageFile: File, maskFile: File, apiKey: string): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API Key is required for inpainting.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash-image-preview';

  try {
    const textPart = { 
      text: `Task: Inpainting. Using the provided mask, replace the masked (white) area of the original image with this content: "${prompt}". The new content should blend seamlessly with the rest of the image.` 
    };
    const originalImagePart = await fileToGenerativePart(originalImageFile);
    const maskPart = await fileToGenerativePart(maskFile);

    const allParts = [textPart, originalImagePart, maskPart];

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: allParts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const images: string[] = [];
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        }
      }
    }

    if (images.length === 0) {
      throw new Error("AI未能生成任何图片。请尝试更换您的提示词或蒙版。");
    }

    return images;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const generateVideo = async (prompt: string, startFile: File, aspectRatio: '16:9' | '9:16', cameraMovement: CameraMovement, apiKey: string): Promise<any> => {
    if (!apiKey) {
        throw new Error("API Key is required to generate videos.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const movementPrompts: Record<CameraMovement, string> = {
        subtle: 'Subtle, ambient motion in the scene. ',
        zoomIn: 'The camera slowly zooms in on the central subject. ',
        zoomOut: 'The camera slowly zooms out, revealing more of the scene. ',
    };

    const fullPrompt = movementPrompts[cameraMovement] + prompt;
    const imagePart = await fileToGenerativePart(startFile);
    
    const requestPayload: any = {
        model: 'veo-2.0-generate-001',
        prompt: fullPrompt,
        image: {
            imageBytes: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType,
        },
        config: {
            numberOfVideos: 1,
            // aspectRatio: aspectRatio, // This parameter causes an error when an image is provided.
        }
    };

    try {
        const operation = await ai.models.generateVideos(requestPayload);
        return operation;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const generateVideoTransition = async (
    startImage: GeneratedImage,
    nextSceneScript: string,
    storyContext: string,
    style: ImageStyle,
    apiKey: string
): Promise<any> => {
    if (!apiKey) {
        throw new Error("API Key is required to generate videos.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = `Create a very short, 1.5-second seamless video transition. The video must start with the provided image. Then, smoothly and cinematically animate it to transition into the following scene: "${nextSceneScript}".
    The overall story is about: "${storyContext}".
    CRITICAL: Maintain this art style throughout the transition: ${stylePrompts[style]}`;
    
    const imagePart = base64ToGenerativePart(startImage.src);
    
    const requestPayload: any = {
        model: 'veo-2.0-generate-001',
        prompt: fullPrompt,
        image: {
            imageBytes: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType,
        },
        config: {
            numberOfVideos: 1,
        }
    };

    try {
        const operation = await ai.models.generateVideos(requestPayload);
        return operation;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const getVideosOperation = async (operation: any, apiKey: string): Promise<any> => {
    if (!apiKey) {
        throw new Error("API Key is required.");
    }
    const ai = new GoogleGenAI({ apiKey });
    try {
        const result = await ai.operations.getVideosOperation({ operation });
        return result;
    } catch (error) {
        throw handleApiError(error);
    }
};
