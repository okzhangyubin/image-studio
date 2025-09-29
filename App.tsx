// App.tsx

// FIX: Imported useState and useEffect from React. Corrected import syntax.
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { IllustratedWiki } from './components/IllustratedWiki';
import { ImageGrid } from './components/ImageGrid';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { ImagePreview } from './components/ImagePreview';
import { ApiKeyModal } from './components/ApiKeyModal';
import { TextToImage } from './components/TextToImage';
import { ImageToImage } from './components/ImageToImage';
import { ImageToVideo } from './components/ImageToVideo';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { ComicStrip } from './components/ComicStrip';
import { History } from './components/History';
import { TagManager } from './components/TagManager';
import { ComicPanelEditorModal } from './components/ComicPanelEditorModal';
// 新增导入导出模态框组件
import { ImportExportModal } from './components/ImportExportModal';
import { ImageStyle, GeneratedImage, HistoryRecord, AppMode, CameraMovement, ImageModel, AspectRatio, InspirationStrength, ComicStripGenerationPhase, ComicStripPanelStatus, ComicStripTransitionStatus, ComicStripTransitionOption } from './types';
import { generateIllustratedCards, generateTextToImage, generateComicStrip, generateVideoScriptsForComicStrip, generateVideo, getVideosOperation, generateVideoTransition } from './services/geminiService';
import { addHistory, getAllHistory, clearHistory, removeHistoryItem, getTags, saveTags, findHistoryBySourceImage } from './services/historyService';
import { resizeImage, createThumbnail, base64ToFile, fileToBase64 } from './utils/imageUtils';
import { stitchVideos } from './utils/videoUtils';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { StarIcon } from './components/icons/StarIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';


const sortHistory = (historyArray: HistoryRecord[]): HistoryRecord[] => {
  return [...historyArray].sort((a, b) => {
    const aIsFavorite = a.images?.some(img => img.isFavorite);
    const bIsFavorite = b.images?.some(img => img.isFavorite);
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    return b.timestamp - a.timestamp;
  });
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('wiki');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // 新增导入导出模态框状态
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState<boolean>(false);

  // State for Wiki mode
  const [wikiPrompt, setWikiPrompt] = useState<string>('');
  const [activeStyle, setActiveStyle] = useState<ImageStyle>(ImageStyle.ILLUSTRATION);
  const [wikiModel, setWikiModel] = useState<ImageModel>(ImageModel.IMAGEN);
  const [cachedImages, setCachedImages] = useState<Record<string, Partial<Record<ImageStyle, Partial<Record<ImageModel, GeneratedImage[]>>>>>>({});

  // State for ComicStrip mode
  const [comicStripStory, setComicStripStory] = useState<string>('');
  const [comicStripStyle, setComicStripStyle] = useState<ImageStyle>(ImageStyle.ILLUSTRATION);
  const [comicStripImages, setComicStripImages] = useState<GeneratedImage[]>([]);
  const [comicStripNumImages, setComicStripNumImages] = useState<number>(4);
  const [comicStripVideoGenerationPhase, setComicStripVideoGenerationPhase] = useState<ComicStripGenerationPhase>('idle');
  const [isGeneratingScripts, setIsGeneratingScripts] = useState<boolean>(false);
  const [comicStripVideoScripts, setComicStripVideoScripts] = useState<string[]>([]);
  const [comicStripVideoUrls, setComicStripVideoUrls] = useState<(string | null)[]>([]);
  const [comicStripPanelStatuses, setComicStripPanelStatuses] = useState<ComicStripPanelStatus[]>([]);
  const [comicStripUseSmartTransitions, setComicStripUseSmartTransitions] = useState<boolean>(true);
  const [comicStripTransitionUrls, setComicStripTransitionUrls] = useState<(string | null)[]>([]);
  const [comicStripTransitionStatuses, setComicStripTransitionStatuses] = useState<ComicStripTransitionStatus[]>([]);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [stitchingProgress, setStitchingProgress] = useState<number>(0);
  const [editingComicPanel, setEditingComicPanel] = useState<{ index: number; prompt: string; image: GeneratedImage } | null>(null);


  // State for TextToImage mode
  const [textToImagePrompt, setTextToImagePrompt] = useState<string>('');
  const [textToImageNegativePrompt, setTextToImageNegativePrompt] = useState<string>('');
  const [textToImageImages, setTextToImageImages] = useState<GeneratedImage[]>([]);
  const [textToImageNumImages, setTextToImageNumImages] = useState<number>(2);
  const [textToImageAspectRatio, setTextToImageAspectRatio] = useState<AspectRatio>('16:9');
  const [textToImageKeywords, setTextToImageKeywords] = useState<string[]>([]);

  // State for ImageToImage mode
  const [imageToImagePrompt, setImageToImagePrompt] = useState<string>('');
  const [imageToImageImages, setImageToImageImages] = useState<GeneratedImage[]>([]);
  const [imageToImageStartFile, setImageToImageStartFile] = useState<File | null>(null);
  const [imageToImageMode, setImageToImageMode] = useState<'edit' | 'inspiration'>('edit');
  const [imageToImageInspirationAspectRatio, setImageToImageInspirationAspectRatio] = useState<AspectRatio>('1:1');
  const [inspirationStrength, setInspirationStrength] = useState<InspirationStrength>('high');
  
  // State for Infinite Canvas mode
  const [infiniteCanvasPrompt, setInfiniteCanvasPrompt] = useState<string>('');
  const [infiniteCanvasStartFile, setInfiniteCanvasStartFile] = useState<File | null>(null);

  // State for Video mode
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [videoStartFile, setVideoStartFile] = useState<File | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoCameraMovement, setVideoCameraMovement] = useState<CameraMovement>('subtle');

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isEnvApiKey, setIsEnvApiKey] = useState<boolean>(false); // 新增状态，用于标识是否使用环境变量中的API Key

  // State for History search and tagging
  const [allTags, setAllTags] = useState<string[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [taggingItem, setTaggingItem] = useState<{ id: string; anchor: DOMRect } | null>(null);


  useEffect(() => {
    // 首先检查环境变量中的API密钥
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined);
    if (envApiKey) {
      setApiKey(envApiKey);
      setIsEnvApiKey(true); // 标记使用环境变量中的API Key
    } else {
      // 如果环境变量中没有API密钥，则检查localStorage
      const genericKey = localStorage.getItem('gemini-api-key-generic');
      if (genericKey) {
        setApiKey(genericKey);
      }
    }
  }, []);
  
  useEffect(() => {
    getAllHistory().then(records => {
      setHistory(sortHistory(records));
    }).catch(err => {
        console.error("Failed to load history:", err);
        setError("无法加载历史记录。");
    });
    getTags().then(tags => {
        setAllTags(tags || []);
    }).catch(err => {
        console.error("Failed to load tags:", err);
        setError("无法加载标签。");
    });
  }, []);


  const handleGenerateWiki = async () => {
    if (!apiKey) {
      setError('请先设置您的 Gemini API Key。');
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreviewImageIndex(null);

    try {
      const imageUrls = await generateIllustratedCards(wikiPrompt, activeStyle, wikiModel, apiKey);

      const resizedImageUrls = await Promise.all(
          imageUrls.map(src => resizeImage(src))
      );
      
      const imagesWithIds: GeneratedImage[] = resizedImageUrls.map((src, index) => ({
        id: `${Date.now()}-${index}`,
        src,
        isFavorite: false,
      }));

      setCachedImages(prevCache => ({
        ...prevCache,
        [wikiPrompt]: {
          ...(prevCache[wikiPrompt] || {}),
          [activeStyle]: {
              ...(prevCache[wikiPrompt]?.[activeStyle] || {}),
              [wikiModel]: imagesWithIds,
          },
        },
      }));
      
      if (imagesWithIds.length > 0) {
        const thumbnail = await createThumbnail(imagesWithIds[0].src);
        const newRecord: HistoryRecord = {
            id: `${Date.now()}`,
            mode: 'wiki',
            prompt: wikiPrompt,
            style: activeStyle,
            model: wikiModel,
            images: imagesWithIds,
            thumbnail,
            timestamp: Date.now(),
        };
        await addHistory(newRecord);
        setHistory(prev => sortHistory([newRecord, ...prev]));
        setSelectedHistoryId(newRecord.id);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误。');
      setCachedImages(prevCache => ({
        ...prevCache,
        [wikiPrompt]: {
          ...(prevCache[wikiPrompt] || {}),
           [activeStyle]: {
              ...(prevCache[wikiPrompt]?.[activeStyle] || {}),
              [wikiModel]: undefined,
          },
        },
      }));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateComicStrip = async () => {
    if (!apiKey) {
        setError('请先设置您的 Gemini API Key。');
        setIsApiKeyModalOpen(true);
        return;
    }
    setIsLoading(true);
    setError(null);
    setComicStripImages([]);
    setComicStripVideoUrls([]);
    setComicStripVideoScripts([]);
    setComicStripTransitionUrls([]);
    setComicStripVideoGenerationPhase('idle');

    try {
        const { imageUrls, panelPrompts } = await generateComicStrip(comicStripStory, comicStripStyle, apiKey, comicStripNumImages);
        const resizedImageUrls = await Promise.all(imageUrls.map(src => resizeImage(src, 800)));
        const imagesWithIds: GeneratedImage[] = resizedImageUrls.map((src, index) => ({
            id: `${Date.now()}-${index}`,
            src,
            isFavorite: false,
        }));
        setComicStripImages(imagesWithIds);
        
        if (imagesWithIds.length > 0) {
            const thumbnail = await createThumbnail(imagesWithIds[0].src);
            const newRecord: HistoryRecord = {
                id: `${Date.now()}`,
                mode: 'comicStrip',
                prompt: comicStripStory,
                style: comicStripStyle,
                model: ImageModel.IMAGEN,
                images: imagesWithIds,
                thumbnail,
                timestamp: Date.now(),
                comicStripNumImages: comicStripNumImages,
                comicStripPanelPrompts: panelPrompts,
                comicStripType: 'images',
            };
            await addHistory(newRecord);
            setHistory(prev => sortHistory([newRecord, ...prev]));
            setSelectedHistoryId(newRecord.id);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : '发生未知错误。');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateComicToVideoScripts = async () => {
    if (!apiKey) {
      setError('请先设置您的 Gemini API Key。');
      setIsApiKeyModalOpen(true);
      return;
    }
    if (comicStripImages.length === 0) {
      setError('没有可用于生成脚本的图片。');
      return;
    }
    setIsGeneratingScripts(true);
    setError(null);

    try {
      const scripts = await generateVideoScriptsForComicStrip(comicStripStory, comicStripImages);
      setComicStripVideoScripts(scripts);
      setComicStripVideoGenerationPhase('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成视频脚本时发生错误。');
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  const handleStartComicToVideoGeneration = async () => {
    if (!apiKey || comicStripImages.length === 0 || comicStripVideoScripts.length === 0) {
        setError('无法开始生成视频，缺少必要信息。');
        return;
    }
    
    setIsLoading(true);
    
    if (comicStripUseSmartTransitions) {
        await handleGenerateComicToVideoWithTransitions();
    } else {
        await handleGenerateComicToVideoSimple();
    }
    
    setIsLoading(false);
  };

  const handleGenerateComicToVideoSimple = async () => {
    if (!apiKey) return;
    try {
        setComicStripVideoGenerationPhase('generating_panels');
        setError(null);
        setComicStripVideoUrls(new Array(comicStripImages.length).fill(null));
        setComicStripTransitionUrls([]);
        setComicStripPanelStatuses(new Array(comicStripImages.length).fill('queued'));

        const parentRecord = history.find(rec => rec.id === selectedHistoryId);
        if (!parentRecord) throw new Error('找不到原始的连环画记录。');

        const concurrencyLimit = 2;
        const allGeneratedUrls: (string | null)[] = new Array(comicStripImages.length).fill(null);

        for (let i = 0; i < comicStripImages.length; i += concurrencyLimit) {
            const chunk = comicStripImages.slice(i, i + concurrencyLimit);
            
            await Promise.all(chunk.map(async (image, chunkIndex) => {
                const originalIndex = i + chunkIndex;
                setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'generating'; return newStatuses; });

                const script = comicStripVideoScripts[originalIndex];
                if (!script?.trim()) {
                    setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'completed'; return newStatuses; });
                    return;
                }

                try {
                    const file = await base64ToFile(image.src, `comic-panel-${originalIndex}.png`);
                    let operation = await generateVideo(script, file, '16:9', 'subtle', apiKey);

                    while (!operation.done) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        operation = await getVideosOperation(operation, apiKey);
                    }

                    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                        const finalUrl = `${downloadLink}&key=${apiKey}`;
                        allGeneratedUrls[originalIndex] = finalUrl;
                        setComicStripVideoUrls(prev => { const newUrls = [...prev]; newUrls[originalIndex] = finalUrl; return newUrls; });
                    } else {
                        throw new Error(`Failed to get video URI for panel ${originalIndex + 1}`);
                    }
                } catch (err) {
                     console.error(`Failed to generate video for panel ${originalIndex + 1}.`, err);
                } finally {
                    setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'completed'; return newStatuses; });
                }
            }));
        }
        
        setComicStripVideoGenerationPhase('completed');

        const newRecord: HistoryRecord = {
            id: `${Date.now()}`,
            mode: 'comicStrip',
            prompt: parentRecord.prompt,
            style: parentRecord.style,
            model: parentRecord.model,
            images: parentRecord.images,
            comicStripPanelPrompts: parentRecord.comicStripPanelPrompts,
            thumbnail: parentRecord.thumbnail,
            timestamp: Date.now(),
            comicStripNumImages: parentRecord.comicStripNumImages,
            videoScripts: comicStripVideoScripts,
            videoUrls: allGeneratedUrls,
            parentId: parentRecord.id,
            comicStripType: 'video',
            transitionOption: 'none',
        };
        await addHistory(newRecord);
        setHistory(prev => sortHistory([newRecord, ...prev]));
        setSelectedHistoryId(newRecord.id);
    } catch (err) {
        setError(err instanceof Error ? err.message : '批量生成视频时发生错误。');
        setComicStripVideoGenerationPhase('editing');
    }
  };

  const handleGenerateComicToVideoWithTransitions = async () => {
    if (!apiKey) return;
    try {
        setError(null);
        // Step 1: Setup
        setComicStripVideoGenerationPhase('generating_panels');
        setComicStripVideoUrls(new Array(comicStripImages.length).fill(null));
        setComicStripTransitionUrls(new Array(comicStripImages.length - 1).fill(null));
        setComicStripPanelStatuses(new Array(comicStripImages.length).fill('queued'));
        setComicStripTransitionStatuses(new Array(comicStripImages.length - 1).fill('queued'));

        const parentRecord = history.find(rec => rec.id === selectedHistoryId);
        if (!parentRecord) throw new Error('找不到原始的连环画记录。');
        
        // Step 2: Generate Panel Videos
        const allGeneratedPanelUrls: (string | null)[] = new Array(comicStripImages.length).fill(null);
        const panelConcurrencyLimit = 2;
        for (let i = 0; i < comicStripImages.length; i += panelConcurrencyLimit) {
            const chunk = comicStripImages.slice(i, i + panelConcurrencyLimit);
            await Promise.all(chunk.map(async (image, chunkIndex) => {
                const originalIndex = i + chunkIndex;
                setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'generating'; return newStatuses; });
                const script = comicStripVideoScripts[originalIndex];
                if (!script?.trim()) {
                    setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'completed'; return newStatuses; });
                    return;
                }
                try {
                    const file = await base64ToFile(image.src, `comic-panel-${originalIndex}.png`);
                    let operation = await generateVideo(script, file, '16:9', 'subtle', apiKey);
                    while (!operation.done) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        operation = await getVideosOperation(operation, apiKey);
                    }
                    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                        const finalUrl = `${downloadLink}&key=${apiKey}`;
                        allGeneratedPanelUrls[originalIndex] = finalUrl;
                        setComicStripVideoUrls(prev => { const newUrls = [...prev]; newUrls[originalIndex] = finalUrl; return newUrls; });
                    } else {
                        throw new Error(`Failed to get video URI for panel ${originalIndex + 1}`);
                    }
                } catch (err) {
                     console.error(`Failed to generate video for panel ${originalIndex + 1}.`, err);
                } finally {
                    setComicStripPanelStatuses(prev => { const newStatuses = [...prev]; newStatuses[originalIndex] = 'completed'; return newStatuses; });
                }
            }));
        }

        // Step 3: Generate Transitions
        setComicStripVideoGenerationPhase('generating_transitions');
        const numTransitions = comicStripImages.length - 1;
        const allGeneratedTransitionUrls: (string | null)[] = new Array(numTransitions).fill(null);

        if (numTransitions > 0) {
            const transitionConcurrencyLimit = 2;
            for (let i = 0; i < numTransitions; i += transitionConcurrencyLimit) {
                const chunkIndices = Array.from({ length: Math.min(transitionConcurrencyLimit, numTransitions - i) }, (_, k) => i + k);
                
                await Promise.all(chunkIndices.map(async (index) => {
                    setComicStripTransitionStatuses(prev => { const newStatuses = [...prev]; newStatuses[index] = 'generating'; return newStatuses; });

                    try {
                        const startImage = comicStripImages[index];
                        const nextSceneScript = comicStripVideoScripts[index + 1];

                        if (!nextSceneScript?.trim()) {
                             return; // Skip if next script is empty
                        }

                        let operation = await generateVideoTransition(startImage, nextSceneScript, comicStripStory, comicStripStyle, apiKey);
                        
                        while (!operation.done) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            operation = await getVideosOperation(operation, apiKey);
                        }

                        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                        if (downloadLink) {
                            const finalUrl = `${downloadLink}&key=${apiKey}`;
                            allGeneratedTransitionUrls[index] = finalUrl;
                            setComicStripTransitionUrls(prev => { const newUrls = [...prev]; newUrls[index] = finalUrl; return newUrls; });
                        } else {
                            throw new Error(`Failed to get video URI for transition ${index + 1}`);
                        }
                    } catch (err) {
                        console.error(`Failed to generate video for transition ${index + 1}.`, err);
                    } finally {
                        setComicStripTransitionStatuses(prev => { const newStatuses = [...prev]; newStatuses[index] = 'completed'; return newStatuses; });
                    }
                }));
            }
        }
        
        setComicStripVideoGenerationPhase('completed');
        
        // Step 4: Save History Record
        const newRecord: HistoryRecord = {
            id: `${Date.now()}`,
            mode: 'comicStrip',
            prompt: parentRecord.prompt,
            style: parentRecord.style,
            model: parentRecord.model,
            images: parentRecord.images,
            thumbnail: parentRecord.thumbnail,
            timestamp: Date.now(),
            comicStripNumImages: parentRecord.comicStripNumImages,
            comicStripPanelPrompts: parentRecord.comicStripPanelPrompts,
            videoScripts: comicStripVideoScripts,
            videoUrls: allGeneratedPanelUrls,
            transitionUrls: allGeneratedTransitionUrls,
            parentId: parentRecord.id,
            comicStripType: 'video',
            transitionOption: 'ai_smart',
        };
        await addHistory(newRecord);
        setHistory(prev => sortHistory([newRecord, ...prev]));
        setSelectedHistoryId(newRecord.id);

    } catch (err) {
        setError(err instanceof Error ? err.message : '生成带转场的视频时发生错误。');
        setComicStripVideoGenerationPhase('editing');
    }
  };


const handleRegenerateSinglePanel = async (index: number) => {
    if (!apiKey || !comicStripImages[index] || !comicStripVideoScripts[index]) {
        setError('无法重新生成，缺少必要信息。');
        return;
    }

    if (comicStripPanelStatuses.some(s => s === 'generating')) {
        return;
    }
    
    setIsLoading(true);
    setComicStripVideoGenerationPhase('generating_panels');
    setError(null);

    setComicStripPanelStatuses(prev => {
        const newStatuses: ComicStripPanelStatus[] = [...prev];
        newStatuses[index] = 'generating';
        return newStatuses;
    });

    try {
        const image = comicStripImages[index];
        const script = comicStripVideoScripts[index];
        const file = await base64ToFile(image.src, `comic-panel-${index}.png`);
        let operation = await generateVideo(script, file, '16:9', 'subtle', apiKey);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await getVideosOperation(operation, apiKey);
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const finalUrl = `${downloadLink}&key=${apiKey}`;
            setComicStripVideoUrls(prev => {
                const newUrls = [...prev];
                newUrls[index] = finalUrl;
                return newUrls;
            });

            const videoRecord = history.find(rec => rec.parentId === selectedHistoryId && rec.comicStripType === 'video');
            if (videoRecord) {
                const updatedVideoUrls = [...(videoRecord.videoUrls || [])];
                updatedVideoUrls[index] = finalUrl;
                const updatedRecord = { ...videoRecord, videoUrls: updatedVideoUrls, timestamp: Date.now() };
                await addHistory(updatedRecord);
                setHistory(prev => sortHistory(prev.map(item => item.id === updatedRecord.id ? updatedRecord : item)));
            }
        } else {
             throw new Error(`面板 ${index + 1} 视频生成失败。`);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : `面板 ${index + 1} 重新生成时发生错误。`);
    } finally {
        setComicStripPanelStatuses(prev => {
            const newStatuses: ComicStripPanelStatus[] = [...prev];
            newStatuses[index] = 'completed';
            return newStatuses;
        });
        setComicStripVideoGenerationPhase('completed');
        setIsLoading(false);
    }
};

const handleOpenComicPanelEditor = (index: number) => {
    const imageRecord = history.find(rec => rec.id === selectedHistoryId);
    if (!imageRecord || !imageRecord.comicStripPanelPrompts || !imageRecord.comicStripPanelPrompts[index]) {
        setError('找不到用于编辑的提示词。');
        return;
    }
    const imageToEdit = comicStripImages[index];
    if (!imageToEdit) {
        setError('找不到要编辑的图片。');
        return;
    }

    setEditingComicPanel({
        index,
        image: imageToEdit,
        prompt: '',
    });
};

const handleComicPanelEditComplete = async (index: number, newImageSrc: string, newPrompt: string) => {
    if (!apiKey) {
        setError('请先设置您的 Gemini API Key。');
        return;
    }
    
    // Optimistically close modal
    setEditingComicPanel(null);

    // Show loading state on main screen
    setIsLoading(true);
    setError(null);

    try {
        const resizedImageUrl = await resizeImage(newImageSrc, 800);
        
        const updatedImages = comicStripImages.map((img, i) => 
            i === index ? { ...img, src: resizedImageUrl } : img
        );
        setComicStripImages(updatedImages);

        const imageRecord = history.find(rec => rec.id === selectedHistoryId);
        if (imageRecord) {
            const updatedPrompts = [...(imageRecord.comicStripPanelPrompts || [])];
            updatedPrompts[index] = newPrompt;

            const updatedRecord: HistoryRecord = {
                ...imageRecord,
                images: updatedImages,
                comicStripPanelPrompts: updatedPrompts,
                thumbnail: await createThumbnail(updatedImages[0].src),
                timestamp: Date.now(),
            };

            await addHistory(updatedRecord);
            setHistory(prev => sortHistory(prev.map(item => item.id === updatedRecord.id ? updatedRecord : item)));
        }

    } catch (err) {
        setError(err instanceof Error ? err.message : '更新画板时发生错误。');
    } finally {
        setIsLoading(false);
    }
};
  
  const handleComicStripScriptChange = (index: number, newScript: string) => {
      setComicStripVideoScripts(prev => {
          const newScripts = [...prev];
          newScripts[index] = newScript;
          return newScripts;
      });
  };

  const handleStitchComicVideos = async () => {
    if (isStitching) return;
    
    const relevantRecord = history.find(rec => rec.id === selectedHistoryId);
    if (!relevantRecord || relevantRecord.comicStripType !== 'video') {
      setError("没有找到可拼接的视频记录。");
      return;
    }
    
    const panelUrls = relevantRecord.videoUrls || [];
    const transitionUrls = relevantRecord.transitionUrls || [];
    
    const allUrls: string[] = [];
    for (let i = 0; i < panelUrls.length; i++) {
      const panelUrl = panelUrls[i];
      if (panelUrl) {
        allUrls.push(panelUrl);
      }
      if (i < transitionUrls.length) {
        const transitionUrl = transitionUrls[i];
        if (transitionUrl) {
          allUrls.push(transitionUrl);
        }
      }
    }
  
    if (allUrls.length < 2) {
      setError("至少需要两个视频片段才能进行拼接。");
      return;
    }
  
    setIsStitching(true);
    setStitchingProgress(0);
    setError(null);
  
    try {
      await stitchVideos(allUrls, (progress) => setStitchingProgress(progress));
    } catch (err) {
      setError(err instanceof Error ? err.message : '拼接视频时发生未知错误。');
    } finally {
      setIsStitching(false);
    }
  };

  const handleGenerateTextToImage = async () => {
    if (!apiKey) {
      setError('请先设置您的 Gemini API Key。');
      setIsApiKeyModalOpen(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    setTextToImageImages([]);

    try {
        const imageUrls = await generateTextToImage(
          textToImagePrompt,
          textToImageKeywords,
          textToImageNegativePrompt,
          apiKey,
          textToImageNumImages,
          textToImageAspectRatio,
        );
        const resizedImageUrls = await Promise.all(imageUrls.map(src => resizeImage(src, 800)));
        const imagesWithIds: GeneratedImage[] = resizedImageUrls.map((src, index) => ({
            id: `${Date.now()}-${index}`,
            src,
            isFavorite: false,
        }));
        setTextToImageImages(imagesWithIds);
        
        if (imagesWithIds.length > 0) {
            const thumbnail = await createThumbnail(imagesWithIds[0].src);
            const newRecord: HistoryRecord = {
                id: `${Date.now()}`,
                mode: 'textToImage',
                prompt: textToImagePrompt,
                negativePrompt: textToImageNegativePrompt,
                images: imagesWithIds,
                thumbnail,
                timestamp: Date.now(),
                numberOfImages: textToImageNumImages,
                aspectRatio: textToImageAspectRatio,
                selectedKeywords: textToImageKeywords,
            };
            await addHistory(newRecord);
            setHistory(prev => sortHistory([newRecord, ...prev]));
            setSelectedHistoryId(newRecord.id);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : '发生未知错误。');
    } finally {
        setIsLoading(false);
    }
  };


  const handleCreativeGenerationStart = () => {
    setIsLoading(true);
  };
  
  const handleVideoStart = () => {
    setGeneratedVideoUrl(null);
    setIsLoading(true);
  };
  
  const handleCreativeGenerationEnd = () => {
    setIsLoading(false);
  };

  const handleImageToImageResult = async (prompt: string, images: GeneratedImage[], sourceFile: File, i2iMode: 'edit' | 'inspiration', settings: { numImages?: number, aspectRatio?: AspectRatio, strength?: InspirationStrength }) => {
    setImageToImagePrompt(prompt);
    setImageToImageImages(images);

    if (images.length > 0 && sourceFile) {
        const sourceImageBase64 = await fileToBase64(sourceFile);
        const parentRecord = await findHistoryBySourceImage(sourceImageBase64);
        
        const thumbnail = images.length > 0 ? await createThumbnail(images[0].src) : await createThumbnail(sourceImageBase64);

        const newRecord: HistoryRecord = {
            id: `${Date.now()}`,
            timestamp: Date.now(),
            mode: 'imageToImage',
            prompt: prompt,
            images: images,
            thumbnail,
            sourceImage: sourceImageBase64,
            i2iMode: i2iMode,
            inspirationNumImages: settings.numImages,
            inspirationAspectRatio: settings.aspectRatio,
            inspirationStrength: settings.strength,
            parentId: parentRecord ? parentRecord.id : null,
        };
        await addHistory(newRecord);
        setHistory(prev => sortHistory([newRecord, ...prev]));
        setSelectedHistoryId(newRecord.id);
    }
  };
  
  const handleInfiniteCanvasResult = async (prompt: string, finalImage: string, sourceFile: File) => {
    if (finalImage && sourceFile) {
        const sourceImageBase64 = await fileToBase64(sourceFile);
        const thumbnail = await createThumbnail(finalImage);
        const finalGeneratedImage: GeneratedImage = {
          id: `${Date.now()}-final`,
          src: finalImage,
          isFavorite: false,
        };

        const newRecord: HistoryRecord = {
            id: `${Date.now()}`,
            timestamp: Date.now(),
            mode: 'infiniteCanvas',
            prompt: prompt,
            images: [finalGeneratedImage],
            thumbnail,
            sourceImage: sourceImageBase64,
        };
        await addHistory(newRecord);
        setHistory(prev => sortHistory([newRecord, ...prev]));
        setSelectedHistoryId(newRecord.id);
    }
  };

  const handleImageUpdate = async (imageId: string, newSrc: string, mode: 'textToImage' | 'imageToImage' | 'comicStrip') => {
      const imageList = mode === 'textToImage' ? textToImageImages : mode === 'imageToImage' ? imageToImageImages : comicStripImages;
      const setList = mode === 'textToImage' ? setTextToImageImages : mode === 'imageToImage' ? setImageToImageImages : setComicStripImages;


      const updatedImagesList = imageList.map(img => 
          img.id === imageId ? { ...img, src: newSrc } : img
      );
      setList(updatedImagesList);
  
      const recordToUpdate = history.find(rec => rec.images?.some(img => img.id === imageId));
      if (recordToUpdate) {
          const updatedImages = recordToUpdate.images!.map(img => 
              img.id === imageId ? { ...img, src: newSrc } : img
          );
  
          const newThumbnail = updatedImages.length > 0 ? await createThumbnail(updatedImages[0].src) : recordToUpdate.thumbnail;
  
          const updatedRecord = {
              ...recordToUpdate,
              images: updatedImages,
              thumbnail: newThumbnail,
              timestamp: Date.now(),
          };
  
          await addHistory(updatedRecord);
          setHistory(prev => sortHistory(prev.map(item => item.id === updatedRecord.id ? updatedRecord : item)));
      }
  };

  const handleVideoResult = async (prompt: string, videoUrl: string, sourceImage: string, cameraMovement: CameraMovement) => {
    setVideoPrompt(prompt);
    setGeneratedVideoUrl(videoUrl);
    setVideoCameraMovement(cameraMovement);

    const thumbnail = await createThumbnail(sourceImage);

    const newRecord: HistoryRecord = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      mode: 'video',
      prompt: prompt,
      videoUrl: videoUrl,
      sourceImage: sourceImage,
      thumbnail: thumbnail,
      cameraMovement: cameraMovement,
      parentId: null,
    };
    await addHistory(newRecord);
    setHistory(prev => sortHistory([newRecord, ...prev]));
    setSelectedHistoryId(newRecord.id);
  };

  const handleSelectHistory = async (item: HistoryRecord) => {
    if (isLoading) return;
    setSelectedHistoryId(item.id);

    setPreviewImageIndex(null);
    setCachedImages({});
    setComicStripImages([]);
    setTextToImageImages([]);
    setImageToImageImages([]);
    setGeneratedVideoUrl(null);
    setVideoStartFile(null);
    setImageToImageStartFile(null);
    setInfiniteCanvasStartFile(null);
    setVideoCameraMovement('subtle');
    setTextToImageKeywords([]);
    setTextToImageNegativePrompt('');
    setInspirationStrength('high');
    setComicStripNumImages(3);
    setComicStripVideoScripts([]);
    setComicStripVideoUrls([]);
    setComicStripTransitionUrls([]);
    setComicStripPanelStatuses([]);
    setComicStripTransitionStatuses([]);
    setComicStripVideoGenerationPhase('idle');

    if (item.mode === 'wiki') {
        setAppMode('wiki');
        setWikiPrompt(item.prompt);
        setActiveStyle(item.style || ImageStyle.ILLUSTRATION);
        setWikiModel(item.model || ImageModel.IMAGEN);
        setCachedImages(prevCache => ({
            ...prevCache,
            [item.prompt]: {
                ...(prevCache[item.prompt] || {}),
                [item.style!]: {
                    [item.model!]: item.images,
                },
            },
        }));
    } else if (item.mode === 'comicStrip') {
        setAppMode('comicStrip');
        setComicStripStory(item.prompt);
        setComicStripStyle(item.style || ImageStyle.ILLUSTRATION);
        setComicStripImages(item.images || []);
        setComicStripNumImages(item.comicStripNumImages || 3);
        setComicStripVideoScripts(item.videoScripts || []);
        setComicStripVideoUrls(item.videoUrls || []);
        setComicStripTransitionUrls(item.transitionUrls || []);
        if (item.comicStripType === 'video' && item.videoScripts) {
            setComicStripVideoGenerationPhase('completed');
            setComicStripUseSmartTransitions(item.transitionOption === 'ai_smart');
        }
    } else if (item.mode === 'textToImage') {
        setAppMode('textToImage');
        setTextToImagePrompt(item.prompt);
        setTextToImageNegativePrompt(item.negativePrompt || '');
        setTextToImageImages(item.images || []);
        setTextToImageNumImages(item.numberOfImages || 2);
        setTextToImageAspectRatio(item.aspectRatio || '16:9');
        setTextToImageKeywords(item.selectedKeywords || []);
    } else if (item.mode === 'imageToImage') {
        setAppMode('imageToImage');
        setImageToImagePrompt(item.prompt);
        setImageToImageImages(item.images || []);
        setImageToImageMode(item.i2iMode || 'edit');
        setImageToImageInspirationAspectRatio(item.inspirationAspectRatio || '1:1');
        setInspirationStrength(item.inspirationStrength || 'high');
        if (item.sourceImage) {
            const file = await base64ToFile(item.sourceImage, `history-i2i-start-source.png`);
            setImageToImageStartFile(file);
        }
    } else if (item.mode === 'infiniteCanvas') {
        setAppMode('infiniteCanvas');
        setInfiniteCanvasPrompt(item.prompt);
        const imageToLoad = item.images?.[0]?.src || item.sourceImage;
        if (imageToLoad) {
            const file = await base64ToFile(imageToLoad, `infinite-canvas-history-start.png`);
            setInfiniteCanvasStartFile(file);
        }
    } else if (item.mode === 'video') {
        setAppMode('video');
        setVideoPrompt(item.prompt);
        setGeneratedVideoUrl(item.videoUrl || null);
        setVideoCameraMovement(item.cameraMovement || 'subtle');
        if (item.sourceImage) {
            const file = await base64ToFile(item.sourceImage, `history-video-start-source.png`);
            setVideoStartFile(file);
        }
    }
    window.scrollTo(0, 0);
  };
  
  const handlePreviewComicPanel = (index: number) => {
      setPreviewImageIndex(index);
  };

  const handleRemoveHistoryItem = async (id: string, isGroup: boolean = false) => {
    try {
      let idsToRemove = [id];
      if (isGroup) {
        const children = history.filter(item => item.parentId === id);
        idsToRemove = [...idsToRemove, ...children.map(c => c.id)];
      }

      await Promise.all(idsToRemove.map(itemId => removeHistoryItem(itemId)));
      
      setHistory(prev => prev.filter(item => !idsToRemove.includes(item.id)));

    } catch (err) {
      console.error("Failed to remove history item(s):", err);
      setError("删除历史记录失败。");
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('您确定要清空所有历史记录吗？此操作无法撤销。')) {
        clearHistory().then(() => {
            setHistory([]);
        }).catch(err => {
            console.error("Failed to clear history:", err);
            setError("清空历史记录失败。");
        });
    }
  };

  const handleToggleFavorite = async (recordId: string, imageId?: string) => {
    const record = history.find(item => item.id === recordId);
    if (!record || !record.images) return;

    let updatedImages: GeneratedImage[];

    if (imageId) {
      // Toggle favorite for a single image
      updatedImages = record.images.map(img => 
          img.id === imageId ? { ...img, isFavorite: !img.isFavorite } : img
      );
    } else {
      // Toggle favorite for all images in the record (bulk action from history list)
      const hasFavorites = record.images.some(img => img.isFavorite);
      updatedImages = record.images.map(img => ({ ...img, isFavorite: !hasFavorites }));
    }

    const updatedRecord = { ...record, images: updatedImages };

    try {
      await addHistory(updatedRecord);
      const newHistory = history.map(item => item.id === recordId ? updatedRecord : item);
      setHistory(sortHistory(newHistory));
      
      // If the currently displayed item was updated, refresh its state to show favorite status change
      switch(updatedRecord.mode) {
        case 'wiki':
          if (updatedRecord.prompt === wikiPrompt && updatedRecord.style === activeStyle && updatedRecord.model === wikiModel) {
              setCachedImages(prev => ({
                  ...prev,
                  [wikiPrompt]: {
                      ...(prev[wikiPrompt] || {}),
                      [activeStyle]: {
                          ...(prev[wikiPrompt]?.[activeStyle] || {}),
                          [wikiModel]: updatedImages
                      }
                  }
              }));
          }
          break;
        case 'comicStrip':
            if (comicStripImages.length > 0 && updatedImages.some(ui => comicStripImages.find(ci => ci.id === ui.id))) {
              setComicStripImages(updatedImages);
            }
            break;
        case 'textToImage':
          // Check if any of the currently displayed images are from the updated record
          if (textToImageImages.length > 0 && updatedImages.some(ui => textToImageImages.find(ti => ti.id === ui.id))) {
              setTextToImageImages(updatedImages);
          }
          break;
        case 'imageToImage':
          if (imageToImageImages.length > 0 && updatedImages.some(ui => imageToImageImages.find(ii => ii.id === ui.id))) {
              setImageToImageImages(updatedImages);
          }
          break;
      }

    } catch (err) {        
      console.error("Failed to update favorite status:", err);
      setError("更新收藏状态失败。");
    }
  };

  const handleOpenTagManager = (id: string, anchor: DOMRect) => {
    setTaggingItem({ id, anchor });
  };
  
  const handleUpdateItemTags = async (itemId: string, newTags: string[]) => {
    const itemToUpdate = history.find(item => item.id === itemId);
    if (!itemToUpdate) return;
  
    const updatedItem = { ...itemToUpdate, tags: newTags };
  
    try {
      await addHistory(updatedItem);
      setHistory(prev => sortHistory(prev.map(item => item.id === itemId ? updatedItem : item)));
    } catch (err) {
      console.error("Failed to update item tags:", err);
      setError("更新标签失败。");
    }
  };
  
  const handleAddTag = async (newTag: string) => {
    if (!newTag || allTags.includes(newTag)) return;
    const updatedTags = [...allTags, newTag];
    setAllTags(updatedTags);
    await saveTags(updatedTags);
  };
  
  const handleDeleteTag = async (tagToDelete: string) => {
    if (!window.confirm(`确定要删除标签 "${tagToDelete}" 吗？此操作将从所有历史记录中移除该标签。`)) {
        return;
    }
    const newAllTags = allTags.filter(t => t !== tagToDelete);
    setAllTags(newAllTags);
    await saveTags(newAllTags);

    const historyUpdatePromises = history
        .filter(item => item.tags?.includes(tagToDelete))
        .map(item => {
            const updatedItem = { ...item, tags: item.tags?.filter(t => t !== tagToDelete) };
            return addHistory(updatedItem); 
        });
    
    await Promise.all(historyUpdatePromises);
    
    // Refresh history from state instead of DB to avoid race conditions
    setHistory(prev => prev.map(item => {
        if (!item.tags?.includes(tagToDelete)) return item;
        return { ...item, tags: item.tags.filter(t => t !== tagToDelete) };
    }));
  };

  const handleModeChange = (mode: AppMode) => {
    setAppMode(mode);
    setSelectedHistoryId(null);
  };

  const handleStyleChange = (style: ImageStyle) => {
    setActiveStyle(style);
    setSelectedHistoryId(null);
  };

  const handleImageClick = (index: number) => {
    setPreviewImageIndex(index);
  };

  const handleClosePreview = () => {
    setPreviewImageIndex(null);
  };

   const handleApiKeySave = (newKey: string) => {
    if (newKey.trim()) {
      const trimmedKey = newKey.trim();
      setApiKey(trimmedKey);
      // 只有在非环境变量API Key的情况下才保存到localStorage
      if (!isEnvApiKey) {
        localStorage.setItem('gemini-api-key-generic', trimmedKey);
      }
      setIsApiKeyModalOpen(false);
      setError(null); 
    }
  };
  
  // 新增导入导出处理函数
  const handleImportExportComplete = () => {
    // 重新加载历史记录
    getAllHistory().then(records => {
      setHistory(sortHistory(records));
    }).catch(err => {
        console.error("Failed to load history after import:", err);
        setError("导入后无法加载历史记录。");
    });
    getTags().then(tags => {
        setAllTags(tags || []);
    }).catch(err => {
        console.error("Failed to load tags after import:", err);
        setError("导入后无法加载标签。");
    });
    
    // 关闭模态框
    setIsImportExportModalOpen(false);
  };

  const handleNavigateToImageToImage = async (sourceImageSrc: string) => {
    try {
        setImageToImageImages([]);
        setTextToImageImages([]);
        setComicStripImages([]);
        const file = await base64ToFile(sourceImageSrc, `from-creative-${Date.now()}.png`);
        setImageToImageStartFile(file);
        setImageToImagePrompt('');
        handleModeChange('imageToImage');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        setError("无法使用该图片继续创作。");
        console.error("Failed to navigate to image-to-image mode:", err);
    }
};

  const handleNavigateToVideo = async (sourceImageSrc: string, sourcePrompt: string) => {
    try {
      setGeneratedVideoUrl(null);
      const file = await base64ToFile(sourceImageSrc, `from-creative-${Date.now()}.png`);
      setVideoStartFile(file);
      setVideoPrompt(sourcePrompt);
      setVideoCameraMovement('subtle');
      handleModeChange('video');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError("无法使用该图片创建视频。");
      console.error("Failed to navigate to video mode:", err);
    }
  };

  const imagesToDisplay = appMode === 'wiki' ? (cachedImages[wikiPrompt]?.[activeStyle]?.[wikiModel] || []) : comicStripImages;

  const handlePreviewChange = (newIndex: number) => {
    const images = appMode === 'wiki' ? (cachedImages[wikiPrompt]?.[activeStyle]?.[wikiModel] || []) : comicStripImages;
    if (newIndex >= 0 && newIndex < images.length) {
      setPreviewImageIndex(newIndex);
    }
  };

  const handleGenericDownload = () => {
    if (previewImageIndex === null) return;

    if (appMode === 'comicStrip' && comicStripVideoUrls[previewImageIndex]) {
        const url = comicStripVideoUrls[previewImageIndex];
        if (!url) return;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = `连环画视频-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    const images = imagesToDisplay;
    if (!images[previewImageIndex]) return;

    const { src, id } = images[previewImageIndex];
    const link = document.createElement('a');
    link.href = src;
    const prefix = appMode === 'wiki' ? '图解百科' : '连环画';
    link.download = `${prefix}-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleTextToImageKeyword = (keyword: string) => {
    setTextToImageKeywords(prev => {
        const keywordsSet = new Set(prev);
        if (keywordsSet.has(keyword)) {
            keywordsSet.delete(keyword);
        } else {
            keywordsSet.add(keyword);
        }
        return Array.from(keywordsSet);
    });
    setSelectedHistoryId(null);
  };
  
  const findRecordByImageId = (imageId: string): HistoryRecord | undefined => {
      return history.find(h => h.images?.some(i => i.id === imageId));
  }

  const handleGenericToggleFavorite = (imageId: string) => {
    const record = findRecordByImageId(imageId);
    if (record) {
      handleToggleFavorite(record.id, imageId);
    }
  };


  const currentPreviewImage = previewImageIndex !== null ? imagesToDisplay[previewImageIndex] : null;
  const isComicStripVideoPreview = appMode === 'comicStrip' && comicStripVideoUrls.length > 0 && previewImageIndex !== null && comicStripVideoUrls[previewImageIndex];
  
  const genericPreviewActions = [
      {
          label: '收藏',
          icon: <StarIcon className="w-5 h-5" />,
          onClick: () => {
            if (currentPreviewImage) {
              handleGenericToggleFavorite(currentPreviewImage.id);
            }
          },
          isActive: !!currentPreviewImage?.isFavorite,
      },
      {
        label: isComicStripVideoPreview ? '下载视频' : '下载图片',
        icon: <DownloadIcon className="w-5 h-5" />,
        onClick: handleGenericDownload,
      }
  ];

  // Handlers to clear selection when inputs change
  const handleWikiPromptChange = (prompt: string) => { setWikiPrompt(prompt); setSelectedHistoryId(null); };
  const handleWikiModelChange = (model: ImageModel) => { setWikiModel(model); setSelectedHistoryId(null); };
  const handleComicStripStoryChange = (story: string) => { setComicStripStory(story); setSelectedHistoryId(null); };
  const handleComicStripStyleChange = (style: ImageStyle) => { setComicStripStyle(style); setSelectedHistoryId(null); };
  const handleComicStripNumImagesChange = (num: number) => { setComicStripNumImages(num); setSelectedHistoryId(null); };
  const handleTextToImagePromptChange = (prompt: string) => { setTextToImagePrompt(prompt); setSelectedHistoryId(null); };
  const handleTextToImageNegativePromptChange = (prompt: string) => { setTextToImageNegativePrompt(prompt); setSelectedHistoryId(null); };
  const handleTextToImageNumImagesChange = (num: number) => { setTextToImageNumImages(num); setSelectedHistoryId(null); };
  const handleTextToImageAspectRatioChange = (ratio: AspectRatio) => { setTextToImageAspectRatio(ratio); setSelectedHistoryId(null); };
  const handleImageToImagePromptChange = (prompt: string) => { setImageToImagePrompt(prompt); setSelectedHistoryId(null); };
  const handleImageToImageStartFileChange = (file: File | null) => { setImageToImageStartFile(file); setSelectedHistoryId(null); };
  const handleImageToImageModeChange = (mode: 'edit' | 'inspiration') => { setImageToImageMode(mode); setSelectedHistoryId(null); };
  const handleImageToImageInspirationAspectRatioChange = (ratio: AspectRatio) => { setImageToImageInspirationAspectRatio(ratio); setSelectedHistoryId(null); };
  const handleInspirationStrengthChange = (strength: InspirationStrength) => { setInspirationStrength(strength); setSelectedHistoryId(null); };
  const handleInfiniteCanvasPromptChange = (prompt: string) => { setInfiniteCanvasPrompt(prompt); setSelectedHistoryId(null); };
  const handleInfiniteCanvasStartFileChange = (file: File | null) => { setInfiniteCanvasStartFile(file); setSelectedHistoryId(null); };
  const handleVideoPromptChange = (prompt: string) => { setVideoPrompt(prompt); setSelectedHistoryId(null); };
  const handleVideoStartFileChange = (file: File | null) => { setVideoStartFile(file); setSelectedHistoryId(null); };
  const handleVideoCameraMovementChange = (movement: CameraMovement) => { setVideoCameraMovement(movement); setSelectedHistoryId(null); };


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Header 
        onApiKeyClick={isEnvApiKey ? undefined : () => setIsApiKeyModalOpen(true)} // 只有在非环境变量API Key的情况下才允许打开API Key模态框
        onImportExportClick={() => setIsImportExportModalOpen(true)}
        appMode={appMode}
        onModeChange={handleModeChange}
        isLoading={isLoading}
      />

      {error && (
        <div className="container mx-auto px-4 pt-4">
          <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">错误：</strong>
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      )}

      {appMode === 'wiki' && (
        <>
          <section className="w-full flex flex-col items-center justify-center py-12 md:py-16 bg-white border-b border-slate-200">
            <div className="container mx-auto px-4">
              <IllustratedWiki
                prompt={wikiPrompt}
                onPromptChange={handleWikiPromptChange}
                onGenerate={handleGenerateWiki}
                isLoading={isLoading}
                activeStyle={activeStyle}
                onStyleChange={handleStyleChange}
                activeModel={wikiModel}
                onModelChange={handleWikiModelChange}
              />
            </div>
          </section>

          <main className="container mx-auto px-4 py-12">
            <div className="mt-4">
              {isLoading ? (
                <LoadingState />
              ) : imagesToDisplay.length > 0 ? (
                <ImageGrid 
                  images={imagesToDisplay} 
                  onImageClick={handleImageClick}
                  onToggleFavorite={handleGenericToggleFavorite}
                />
              ) : (
                <EmptyState />
              )}
            </div>
          </main>
        </>
      )}
      
      {appMode === 'comicStrip' && (
        <ComicStrip
            onGenerate={handleGenerateComicStrip}
            isLoading={isLoading}
            story={comicStripStory}
            onStoryChange={handleComicStripStoryChange}
            style={comicStripStyle}
            onStyleChange={handleComicStripStyleChange}
            images={comicStripImages}
            onImageClick={handleImageClick}
            onToggleFavorite={handleGenericToggleFavorite}
            onEditPanel={handleOpenComicPanelEditor}
            numberOfImages={comicStripNumImages}
            onNumberOfImagesChange={handleComicStripNumImagesChange}
            onGenerateVideoScripts={handleGenerateComicToVideoScripts}
            videoGenerationPhase={comicStripVideoGenerationPhase}
            onPhaseChange={setComicStripVideoGenerationPhase}
            isGeneratingScripts={isGeneratingScripts}
            videoScripts={comicStripVideoScripts}
            onScriptChange={handleComicStripScriptChange}
            onStartVideoGeneration={handleStartComicToVideoGeneration}
            videoUrls={comicStripVideoUrls}
            panelStatuses={comicStripPanelStatuses}
            onPreviewComicPanel={handlePreviewComicPanel}
            onRegeneratePanel={handleRegenerateSinglePanel}
            useSmartTransitions={comicStripUseSmartTransitions}
            onUseSmartTransitionsChange={setComicStripUseSmartTransitions}
            transitionUrls={comicStripTransitionUrls}
            transitionStatuses={comicStripTransitionStatuses}
            isStitching={isStitching}
            stitchingProgress={stitchingProgress}
            onStitchVideos={handleStitchComicVideos}
        />
      )}

      {appMode === 'textToImage' && (
        <TextToImage
            apiKey={apiKey}
            onApiKeyNeeded={() => setIsApiKeyModalOpen(true)}
            onGenerate={handleGenerateTextToImage}
            prompt={textToImagePrompt}
            onPromptChange={handleTextToImagePromptChange}
            generatedImages={textToImageImages}
            onNavigateToImageToImage={handleNavigateToImageToImage}
            onNavigateToVideo={handleNavigateToVideo}
            isLoading={isLoading}
            onImageUpdate={(id, src) => handleImageUpdate(id, src, 'textToImage')}
            numberOfImages={textToImageNumImages}
            onNumberOfImagesChange={handleTextToImageNumImagesChange}
            aspectRatio={textToImageAspectRatio}
            onAspectRatioChange={handleTextToImageAspectRatioChange}
            selectedKeywords={textToImageKeywords}
            onToggleKeyword={handleToggleTextToImageKeyword}
            onToggleFavorite={handleGenericToggleFavorite}
        />
      )}

      {appMode === 'imageToImage' && (
        <ImageToImage
            apiKey={apiKey}
            onApiKeyNeeded={() => setIsApiKeyModalOpen(true)}
            onGenerationStart={handleCreativeGenerationStart}
            onGenerationEnd={handleCreativeGenerationEnd}
            onResult={handleImageToImageResult}
            prompt={imageToImagePrompt}
            onPromptChange={handleImageToImagePromptChange}
            generatedImages={imageToImageImages}
            onNavigateToVideo={handleNavigateToVideo}
            isLoading={isLoading}
            onImageUpdate={(id, src) => handleImageUpdate(id, src, 'imageToImage')}
            initialStartFile={imageToImageStartFile}
            onStartFileChange={handleImageToImageStartFileChange}
            i2iMode={imageToImageMode}
            onI2iModeChange={handleImageToImageModeChange}
            inspirationAspectRatio={imageToImageInspirationAspectRatio}
            onInspirationAspectRatioChange={handleImageToImageInspirationAspectRatioChange}
            inspirationStrength={inspirationStrength}
            onInspirationStrengthChange={handleInspirationStrengthChange}
            onToggleFavorite={handleGenericToggleFavorite}
        />
      )}

      {appMode === 'infiniteCanvas' && (
        <InfiniteCanvas
            apiKey={apiKey}
            onApiKeyNeeded={() => setIsApiKeyModalOpen(true)}
            onResult={handleInfiniteCanvasResult}
            initialPrompt={infiniteCanvasPrompt}
            onPromptChange={handleInfiniteCanvasPromptChange}
            initialStartFile={infiniteCanvasStartFile}
            onStartFileChange={handleInfiniteCanvasStartFileChange}
            onGenerationStart={handleCreativeGenerationStart}
            onGenerationEnd={handleCreativeGenerationEnd}
            isLoading={isLoading}
        />
      )}

      {appMode === 'video' && (
        <ImageToVideo
            apiKey={apiKey}
            onApiKeyNeeded={() => setIsApiKeyModalOpen(true)}
            onResult={handleVideoResult}
            initialPrompt={videoPrompt}
            onPromptChange={handleVideoPromptChange}
            initialStartFile={videoStartFile}
            onStartFileChange={handleVideoStartFileChange}
            generatedVideoUrl={generatedVideoUrl}
            onGenerationStart={handleVideoStart}
            onGenerationEnd={handleCreativeGenerationEnd}
            isLoading={isLoading}
            cameraMovement={videoCameraMovement}
            onCameraMovementChange={handleVideoCameraMovementChange}
        />
      )}

      <History 
        history={history}
        onSelect={handleSelectHistory}
        onClear={handleClearHistory}
        onRemove={handleRemoveHistoryItem}
        onToggleFavorite={handleToggleFavorite}
        selectedId={selectedHistoryId}
        isLoading={isLoading}
        searchQuery={historySearchQuery}
        onSearchChange={setHistorySearchQuery}
        onOpenTagManager={handleOpenTagManager}
      />
      
      <ImagePreview 
        images={imagesToDisplay}
        currentIndex={previewImageIndex}
        onClose={handleClosePreview}
        onChange={handlePreviewChange}
        actions={genericPreviewActions}
        videoUrl={isComicStripVideoPreview && previewImageIndex !== null ? comicStripVideoUrls[previewImageIndex] ?? undefined : undefined}
      />
      
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={handleApiKeySave}
        currentApiKey={isEnvApiKey ? null : apiKey} // 如果是环境变量API Key，则不显示当前key
      />

      <ComicPanelEditorModal
        isOpen={!!editingComicPanel}
        onClose={() => setEditingComicPanel(null)}
        panelData={editingComicPanel}
        apiKey={apiKey}
        onComplete={handleComicPanelEditComplete}
        onApiKeyNeeded={() => setIsApiKeyModalOpen(true)}
      />

      {taggingItem && (
        <TagManager
          isOpen={!!taggingItem}
          onClose={() => setTaggingItem(null)}
          allTags={allTags}
          itemTags={history.find(item => item.id === taggingItem.id)?.tags || []}
          anchorRect={taggingItem.anchor}
          onUpdateItemTags={(newTags) => handleUpdateItemTags(taggingItem.id, newTags)}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
        />
      )}
      
      {/* 新增导入导出模态框 */}
      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        onImportComplete={handleImportExportComplete}
      />
    </div>
  );
};

export default App;
