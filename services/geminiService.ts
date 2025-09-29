// services/geminiService.ts

import { GoogleGenAI, Modality, GenerateImagesConfig } from "@google/genai";
import { ImageStyle, CameraMovement, ImageModel, AspectRatio, InspirationStrength, GeneratedImage } from '../types';
import {
  generateComicPanelPrompts,
  generateVideoStoryboard,
  generateWikiCardPrompts,
  generateTextToImagePrompt,
  generateImageEditPrompt,
  generateStyleInspirationPrompt,
  generateInpaintingPrompt,
  generateVideoPrompt,
  generateVideoTransitionPrompt,
} from './openAITextService';

import {
  generateComicPanelPrompts,
  generateVideoStoryboard,
  generateWikiCardPrompts,
  generateTextToImagePrompt,
  generateImageEditPrompt,
  generateStyleInspirationPrompt,
  generateInpaintingPrompt,
  generateVideoPrompt,
  generateVideoTransitionPrompt,
} from './openAITextService';
import { generateComicPanelPrompts, generateVideoStoryboard } from './openAITextService';

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
    const cardPrompts = await generateWikiCardPrompts(prompt, stylePrompts[style], 4);

    if (model === ImageModel.NANO_BANANA) {
      const responses = await Promise.all(cardPrompts.map(async (cardPrompt) => {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [{ text: cardPrompt }],
          },
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
          },
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(part => part.inlineData?.data);
        if (!imagePart?.inlineData?.data) {
          throw new Error('AI未能生成图解卡片。');
        }
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      }));

      if (responses.length > 0) {
        return responses;
      }

    } else if (model === ImageModel.IMAGEN) {
      const responses = await Promise.all(cardPrompts.map(async (cardPrompt) => {
        const response = await ai.models.generateImages({
          model: model,
          prompt: cardPrompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9',
          },
        });

        const generated = response.generatedImages?.[0]?.image?.imageBytes;
        if (!generated) {
          throw new Error('AI未能生成图解卡片。');
        }
        return `data:image/jpeg;base64,${generated}`;
      }));

      if (responses.length > 0) {
        return responses;
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
    const panelPrompts = await generateComicPanelPrompts(story, stylePrompts[style], numberOfImages);

    try {
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
        const refinedPrompt = await generateImageEditPrompt(prompt);
        const textPart = { text: refinedPrompt };

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


export const generateVideoScriptsForComicStrip = async (story: string, images: GeneratedImage[]): Promise<string[]> => {
    const storyboardSegments = await generateVideoStoryboard(story, images);

    const scripts = storyboardSegments.map((item) => {
        return `${item.cameraMovement}的${item.shotType}，${item.actionDescription}画面充满${item.emotionalTone}的氛围。`;
    });

    if (scripts.length !== images.length) {
        console.warn(`OpenAI兼容API返回的镜头脚本数量 (${scripts.length}) 与图片数量 (${images.length}) 不一致，将进行裁剪或填充。`);
        const adjustedScripts = new Array(images.length).fill('');
        for (let i = 0; i < Math.min(scripts.length, images.length); i++) {
            adjustedScripts[i] = scripts[i];
        }
        return adjustedScripts;
    }

    return scripts;
};


export const generateTextToImage = async (
  prompt: string,
  keywords: string[],
  negativePrompt: string,
  apiKey: string,
  numberOfImages: number,
  aspectRatio: AspectRatio,
): Promise<string[]> => {
    if (!apiKey) {
      throw new Error("API Key is required to generate images.");
    }
    const ai = new GoogleGenAI({ apiKey });

    try {
      const { positivePrompt, negativePrompt: refinedNegativePrompt } = await generateTextToImagePrompt(
        prompt,
        keywords,
        aspectRatio,
        numberOfImages,
        negativePrompt,
      );

      const config: GenerateImagesConfig = {
        numberOfImages: numberOfImages,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio,
      };

      const finalNegativePrompt = refinedNegativePrompt?.trim() || negativePrompt.trim();
      if (finalNegativePrompt) {
        config.negativePrompt = finalNegativePrompt;
      }

      const response = await ai.models.generateImages({
        model: ImageModel.IMAGEN,
        prompt: positivePrompt,
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
    const refinedPrompt = await generateImageEditPrompt(prompt);

    const allParts = [
      ...imageParts,
      { text: `Using the provided reference image(s), ${refinedPrompt}` },
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
    const refinedPrompt = await generateStyleInspirationPrompt(newPrompt, strength);

    const textPart = {
      text: refinedPrompt
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
    const refinedPrompt = await generateInpaintingPrompt(prompt);
    const textPart = {
      text: `Task: Inpainting. Using the provided mask, replace the masked (white) area of the original image with content described as: ${refinedPrompt}`
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

    const movementDescriptor = movementPrompts[cameraMovement];
    const refinedPrompt = await generateVideoPrompt(`${prompt}\n\nCamera instruction: ${movementDescriptor}`, cameraMovement);
    const imagePart = await fileToGenerativePart(startFile);

    const requestPayload: any = {
        model: 'veo-2.0-generate-001',
        prompt: refinedPrompt,
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

    const refinedPrompt = await generateVideoTransitionPrompt(nextSceneScript, storyContext, stylePrompts[style]);

    const imagePart = base64ToGenerativePart(startImage.src);

    const requestPayload: any = {
        model: 'veo-2.0-generate-001',
        prompt: refinedPrompt,
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
