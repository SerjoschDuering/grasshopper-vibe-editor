/**
 * Image processing utilities for AI chat functionality
 */

/**
 * Process an image file for AI upload
 * - Resizes to max width of 1280px (maintaining aspect ratio)
 * - Converts to JPEG format
 * - Returns base64 data URI
 */
export async function processImageForAI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'))
      return
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      reject(new Error('Image must be smaller than 10MB'))
      return
    }

    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas not supported'))
      return
    }

    img.onload = () => {
      try {
        // Calculate new dimensions (max width 1280px)
        const MAX_WIDTH = 1280
        let { width, height } = img
        
        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width
          width = MAX_WIDTH
        }

        // Set canvas size
        canvas.width = width
        canvas.height = height

        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to JPEG base64 (quality 0.9)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        
        // Clean up
        URL.revokeObjectURL(img.src)
        
        resolve(dataUrl)
      } catch (error) {
        reject(new Error('Failed to process image: ' + (error as Error).message))
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Load image
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Validate if a file is a supported image format
 */
export function isValidImageFile(file: File): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ]
  
  return supportedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}