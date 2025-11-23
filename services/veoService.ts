import { GoogleGenAI, VideoGenerationReferenceType } from '@google/genai';
import { AspectRatio, GeneratedVideo } from '../types';

/**
 * Converts a File object to a base64 encoded string.
 * @param file The File object to convert.
 * @returns A promise that resolves with the base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Generates a video from a prompt and an optional starting image using the Veo API.
 * @param prompt The text prompt for video generation.
 * @param imageBase64 The base64 encoded string of the starting image (optional).
 * @param imageMimeType The MIME type of the starting image (optional).
 * @param aspectRatio The desired aspect ratio for the video ('16:9' or '9:16').
 * @returns A promise that resolves with the URI of the generated video operation.
 */
export const generateVeoVideo = async (
  prompt: string,
  imageBase64: string | null,
  imageMimeType: string | null,
  aspectRatio: AspectRatio,
): Promise<string> => {
  // CRITICAL: Create a new GoogleGenAI instance right before making an API call
  // to ensure it always uses the most up-to-date API key from the dialog.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'veo-3.1-fast-generate-preview'; // Specified model

  const contents: any = {
    model,
    prompt: prompt || 'Animate this image into a video.', // Prompt is optional when image is provided, but good to have a default.
    config: {
      numberOfVideos: 1,
      resolution: '720p', // Defaulting to 720p as per common practice and for quicker generation.
      aspectRatio: aspectRatio,
    },
  };

  if (imageBase64 && imageMimeType) {
    contents.image = {
      imageBytes: imageBase64,
      mimeType: imageMimeType,
    };
  } else {
    // If no image, prompt is required by the API.
    if (!prompt) {
      throw new Error("A prompt is required if no image is provided.");
    }
  }

  let operation = await ai.models.generateVideos(contents);

  // Poll for operation completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error('Failed to retrieve video download link.');
  }

  return downloadLink;
};

/**
 * Fetches the video bytes from a URI and returns a Blob URL.
 * @param videoUri The URI of the video to fetch.
 * @returns A promise that resolves with the Blob URL of the video.
 */
export const fetchVideoAsBlobUrl = async (videoUri: string): Promise<string> => {
  const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.statusText}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
