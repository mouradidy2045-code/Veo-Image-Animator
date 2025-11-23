import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateVeoVideo, fileToBase64, fetchVideoAsBlobUrl } from './services/veoService';
import { AspectRatio, GeneratedVideo } from './types';

// Helper component for the API Key selection prompt
interface ApiKeyPromptProps {
  onApiKeySelected: () => void;
  errorMessage: string | null;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onApiKeySelected, errorMessage }) => {
  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    // Assume key selection was successful and proceed to the app.
    // A race condition can occur where hasSelectedApiKey() may not immediately return true.
    onApiKeySelected();
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-yellow-50 border-yellow-200 border rounded-lg shadow-md text-center max-w-md mx-auto my-8">
      <p className="text-lg text-yellow-800 mb-4">
        To generate videos, you need to select a paid API key from a GCP project.
      </p>
      {errorMessage && (
        <p className="text-red-600 mb-4">{errorMessage}</p>
      )}
      <button
        onClick={handleSelectKey}
        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
      >
        Select API Key
      </button>
      <p className="text-sm text-gray-600 mt-4">
        Learn more about billing: {' '}
        <a
          href="https://ai.google.dev/gemini-api/docs/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          ai.google.dev/gemini-api/docs/billing
        </a>
      </p>
    </div>
  );
};


const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);

  // Ref to store the actual file content as base64 and its mimeType
  const imageBase64Ref = useRef<string | null>(null);
  const imageMimeTypeRef = useRef<string | null>(null);

  const checkApiKeyStatus = useCallback(async () => {
    try {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      } else {
        // Fallback for environments where aistudio might not be available (e.g., local dev)
        console.warn('window.aistudio.hasSelectedApiKey not available. Assuming API key is set for development.');
        setApiKeySelected(true);
      }
    } catch (error) {
      console.error('Error checking API key status:', error);
      setApiKeySelected(false);
      setErrorMessage('Failed to check API key status. Please try again.');
    }
  }, []);

  useEffect(() => {
    checkApiKeyStatus();
  }, [checkApiKeyStatus]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please upload a valid image file (e.g., PNG, JPEG).');
        setImageFile(null);
        setImagePreviewUrl(null);
        imageBase64Ref.current = null;
        imageMimeTypeRef.current = null;
        return;
      }

      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      try {
        const base64 = await fileToBase64(file);
        imageBase64Ref.current = base64;
        imageMimeTypeRef.current = file.type;
      } catch (error) {
        setErrorMessage('Failed to read image file.');
        console.error('File to base64 conversion error:', error);
        setImageFile(null);
        setImagePreviewUrl(null);
        imageBase64Ref.current = null;
        imageMimeTypeRef.current = null;
      }
    } else {
      setImageFile(null);
      setImagePreviewUrl(null);
      imageBase64Ref.current = null;
      imageMimeTypeRef.current = null;
    }
  };

  const handleGenerateVideo = async () => {
    setErrorMessage(null);
    setGeneratedVideo(null);
    if (!apiKeySelected) {
      setErrorMessage('Please select an API key first.');
      return;
    }

    if (!imageFile && !prompt.trim()) {
      setErrorMessage('Please upload an image or provide a prompt to generate a video.');
      return;
    }

    setIsLoading(true);
    try {
      const videoUri = await generateVeoVideo(
        prompt.trim(),
        imageBase64Ref.current,
        imageMimeTypeRef.current,
        aspectRatio,
      );
      const blobUrl = await fetchVideoAsBlobUrl(videoUri);
      setGeneratedVideo({ uri: videoUri, blobUrl });
    } catch (error: any) {
      console.error('Video generation error:', error);
      // Specific error handling for "Requested entity was not found."
      if (error.message && error.message.includes("Requested entity was not found.")) {
        setApiKeySelected(false); // Reset API key status
        setErrorMessage('API Key might be invalid or expired. Please re-select your API key.');
      } else {
        setErrorMessage(`Failed to generate video: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setPrompt('');
    setGeneratedVideo(null);
    setErrorMessage(null);
    setIsLoading(false);
    imageBase64Ref.current = null;
    imageMimeTypeRef.current = null;
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gray-50">
      <header className="w-full max-w-4xl text-center py-6">
        <h1 className="text-4xl font-extrabold text-blue-800 mb-2">Veo Image Animator</h1>
        <p className="text-lg text-gray-600">Bring your images to life with AI-powered video generation.</p>
      </header>

      {!apiKeySelected && (
        <ApiKeyPrompt onApiKeySelected={checkApiKeyStatus} errorMessage={errorMessage} />
      )}

      {apiKeySelected && (
        <main className="w-full max-w-4xl bg-white shadow-xl rounded-lg p-8 space-y-8 mb-24 md:mb-8">
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Error! </strong>
              <span className="block sm:inline">{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
              >
                <svg
                  className="fill-current h-6 w-6 text-red-500"
                  role="button"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <title>Close</title>
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
                </svg>
              </button>
            </div>
          )}

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Upload Image (Optional)</h2>
            <div className="flex flex-col items-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors cursor-pointer">
              <label htmlFor="image-upload" className="cursor-pointer">
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isLoading}
                />
                {!imagePreviewUrl ? (
                  <div className="flex flex-col items-center">
                    <svg
                      className="w-12 h-12 text-gray-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      ></path>
                    </svg>
                    <p className="text-lg text-gray-600">Click to upload or drag & drop</p>
                    <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                ) : (
                  <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-lg overflow-hidden border border-gray-200">
                    <img src={imagePreviewUrl} alt="Image preview" className="object-cover w-full h-full" />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreviewUrl(null);
                        imageBase64Ref.current = null;
                        imageMimeTypeRef.current = null;
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs"
                      aria-label="Remove image"
                    >
                      X
                    </button>
                  </div>
                )}
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Enter Prompt</h2>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-y min-h-[80px]"
              rows={3}
              placeholder="Describe the video you want to generate (e.g., 'A futuristic city at sunset' or 'make the robot skateboard'). Required if no image is uploaded."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
            ></textarea>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">3. Select Aspect Ratio</h2>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  className="form-radio h-5 w-5 text-blue-600"
                  name="aspect-ratio"
                  value="16:9"
                  checked={aspectRatio === '16:9'}
                  onChange={() => setAspectRatio('16:9')}
                  disabled={isLoading}
                />
                <span className="ml-2 text-gray-700">16:9 (Landscape)</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  className="form-radio h-5 w-5 text-blue-600"
                  name="aspect-ratio"
                  value="9:16"
                  checked={aspectRatio === '9:16'}
                  onChange={() => setAspectRatio('9:16')}
                  disabled={isLoading}
                />
                <span className="ml-2 text-gray-700">9:16 (Portrait)</span>
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">4. Generated Video</h2>
            <div className="min-h-[200px] bg-gray-100 rounded-lg flex items-center justify-center p-4">
              {isLoading && (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-dashed border-blue-500 border-t-transparent mb-3"></div>
                  <p className="text-blue-700 font-semibold">Generating video... This may take a few minutes.</p>
                  <p className="text-gray-500 text-sm mt-1">Please wait, your masterpiece is being created.</p>
                </div>
              )}
              {generatedVideo?.blobUrl && !isLoading && (
                <video
                  controls
                  src={generatedVideo.blobUrl}
                  className="max-w-full max-h-[400px] rounded-lg shadow-md"
                  autoPlay
                  loop
                >
                  Your browser does not support the video tag.
                </video>
              )}
              {!isLoading && !generatedVideo?.blobUrl && (
                <p className="text-gray-500">No video generated yet.</p>
              )}
            </div>
          </section>
        </main>
      )}

      {apiKeySelected && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex justify-center z-10">
          <div className="w-full max-w-4xl flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleGenerateVideo}
              disabled={isLoading || (!imageFile && !prompt.trim())}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : 'Generate Video'}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;