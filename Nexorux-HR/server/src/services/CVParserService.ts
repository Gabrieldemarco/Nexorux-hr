import { logger } from '../logs/logger';

// Use dynamic import to allow mocking in tests
let pdfParseModule: any = null;
async function getPdfParse() {
  if (!pdfParseModule) {
    const mod = await import('pdf-parse');
    pdfParseModule = mod.default;
  }
  return pdfParseModule;
}

export interface ParsedCV {
  text: string;
  pageCount: number;
  fileSize: number;
  metadata: Record<string, any>;
}

export class CVParserService {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  static async parsePDF(buffer: Buffer, filename: string): Promise<ParsedCV> {
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File ${filename} exceeds maximum size of 10MB`);
    }

    try {
      const pdfParse = await getPdfParse();
      const data = await pdfParse(buffer);
      
      const cleanedText = this.cleanExtractedText(data.text);
      
      if (cleanedText.trim().length < 50) {
        logger.warn('CV text too short after extraction', { 
          filename, 
          textLength: cleanedText.length,
          pageCount: data.numpages 
        });
      }

      return {
        text: cleanedText,
        pageCount: data.numpages,
        fileSize: buffer.length,
        metadata: data.metadata || {}
      };
    } catch (error: any) {
      logger.error('PDF parsing failed', { filename, error: error.message });
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  static async parseMultiplePDFs(files: Array<{ buffer: Buffer; filename: string }>): Promise<ParsedCV[]> {
    const results: ParsedCV[] = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        const parsed = await this.parsePDF(file.buffer, file.filename);
        results.push(parsed);
      } catch (error: any) {
        errors.push({ filename: file.filename, error: error.message });
      }
    }

    if (errors.length > 0) {
      logger.warn('Some PDFs failed to parse', { errors });
    }

    return results;
  }

  private static cleanExtractedText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\u0000/g, '')
      .trim();
  }

  static validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'Only PDF files are accepted' };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds 10MB limit (got ${Math.round(file.size / 1024 / 1024)}MB)` };
    }

    if (!file.buffer || file.buffer.length === 0) {
      return { valid: false, error: 'Empty file' };
    }

    return { valid: true };
  }
}