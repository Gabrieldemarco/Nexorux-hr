import Groq from 'groq-sdk';
import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logs/logger';

export interface CVAnalysisInput {
  jobOpeningId: string;
  cvText: string;
  candidateId?: string;
  originalFilename: string;
}

export interface ExtractedCVData {
  nombre: string;
  correo: string;
  telefono: string;
  anos_experiencia: number;
  habilidades_tecnicas: string[];
  educacion_superior: string;
}

export interface CVAnalysisResult {
  clasificacion: 'elegible' | 'descartado';
  razonamiento: string;
  datos_extraidos: ExtractedCVData;
  match_score: number;
  missing_requirements: string[];
}

export class CVAnalyzerService {
  private static client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  private static models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

  private static buildAnalysisPrompt(jobData: any, cvText: string): string {
    return `Eres un filtrador automático de CVs especializado en recruiting técnico.
Analiza el CV contra los requisitos de la vacante y devuelve EXACTAMENTE este JSON (sin explicaciones, sin markdown):

{
  "clasificacion": "elegible" | "descartado",
  "razonamiento": "1-2 frases explicando por qué según las reglas",
  "datos_extraidos": {
    "nombre": "",
    "correo": "",
    "telefono": "",
    "anos_experiencia": number,
    "habilidades_tecnicas": [],
    "educacion_superior": ""
  },
  "match_score": number,
  "missing_requirements": []
}

REGLAS DE ELEGIBILIDAD:
✅ Elegible si:
  - Email y teléfono válidos
  - ≥1 año experiencia en rol técnico relevante
  - ≥3 habilidades técnicas relevantes para la vacante
  - Texto legible (>80 palabras coherentes)
❌ Descartado si:
  - Faltan contactos válidos
  - <0.5 años experiencia o solo proyectos académicos
  - Habilidades incompletas/formato incoherente/texto fragmentado (<50 palabras)
  - Indica "no disponible" o datos falsos

VACANTE:
Título: ${jobData.title}
Descripción: ${jobData.description || 'N/A'}
Requisitos: ${jobData.requirements || 'N/A'}
Habilidades requeridas: ${jobData.required_skills || 'N/A'}

CV EXTRAÍDO:
${cvText.slice(0, 8000)}`;
  }

  private static async callAI(prompt: string): Promise<string> {
    let lastError: any = null;
    for (const model of this.models) {
      try {
        const completion = await this.client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'Eres un filtrador automático de CVs especializado en recruiting técnico. Devuelve solo JSON válido.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.0,
          max_tokens: 1500
        });

        const response = completion.choices?.[0]?.message?.content || '';
        const trimmed = typeof response === 'string' ? response.trim() : '';
        if (!trimmed) continue;
        return trimmed;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError;
  }

  static async analyzeCV(tenantId: string, input: CVAnalysisInput): Promise<CVAnalysisResult & { id: string }> {
    const jobOpening = db.prepare(
      'SELECT title, description, requirements, required_skills FROM job_openings WHERE id = ? AND tenant_id = ?'
    ).get(input.jobOpeningId, tenantId) as any;

    if (!jobOpening) {
      throw new Error('Job opening not found');
    }

    const prompt = this.buildAnalysisPrompt(jobOpening, input.cvText);
    let aiResponse: string;

    try {
      aiResponse = await this.callAI(prompt);
    } catch (error: any) {
      logger.error('AI analysis failed, using fallback', { error: error.message });
      const fallback = this.fallbackAnalysis(input.cvText, jobOpening);
      const analysisId = uuidv4();
      db.prepare(`
        INSERT INTO cv_analyses (
          id, tenant_id, job_opening_id, candidate_id, original_filename,
          extracted_text, classification, reasoning,
          nombre, correo, telefono, anos_experiencia,
          habilidades_tecnicas, educacion_superior,
          match_score, missing_requirements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        analysisId,
        tenantId,
        input.jobOpeningId,
        input.candidateId || null,
        input.originalFilename,
        input.cvText,
        fallback.clasificacion,
        fallback.razonamiento,
        fallback.datos_extraidos.nombre,
        fallback.datos_extraidos.correo,
        fallback.datos_extraidos.telefono,
        fallback.datos_extraidos.anos_experiencia,
        JSON.stringify(fallback.datos_extraidos.habilidades_tecnicas),
        fallback.datos_extraidos.educacion_superior,
        fallback.match_score,
        JSON.stringify(fallback.missing_requirements)
      );
      return { ...fallback, id: analysisId };
    }

    let result: CVAnalysisResult;
    try {
      const parsed = JSON.parse(aiResponse);
      result = this.validateAndNormalizeResult(parsed, input.cvText);
    } catch (error: any) {
      logger.error('Failed to parse AI response, using fallback', { response: aiResponse.slice(0, 500) });
      result = this.fallbackAnalysis(input.cvText, jobOpening);
    }

    const analysisId = uuidv4();
    db.prepare(`
      INSERT INTO cv_analyses (
        id, tenant_id, job_opening_id, candidate_id, original_filename,
        extracted_text, classification, reasoning,
        nombre, correo, telefono, anos_experiencia,
        habilidades_tecnicas, educacion_superior,
        match_score, missing_requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysisId,
      tenantId,
      input.jobOpeningId,
      input.candidateId || null,
      input.originalFilename,
      input.cvText,
      result.clasificacion,
      result.razonamiento,
      result.datos_extraidos.nombre,
      result.datos_extraidos.correo,
      result.datos_extraidos.telefono,
      result.datos_extraidos.anos_experiencia,
      JSON.stringify(result.datos_extraidos.habilidades_tecnicas),
      result.datos_extraidos.educacion_superior,
      result.match_score,
      JSON.stringify(result.missing_requirements)
    );

    logger.info('CV analysis completed', {
      analysisId,
      tenantId,
      jobOpeningId: input.jobOpeningId,
      classification: result.clasificacion,
      matchScore: result.match_score
    });

    return { ...result, id: analysisId };
  }

  static async batchAnalyzeCVs(tenantId: string, jobOpeningId: string, cvs: Array<{ text: string; filename: string }>): Promise<Array<CVAnalysisResult & { id: string; filename: string }>> {
    const results: Array<CVAnalysisResult & { id: string; filename: string }> = [];
    
    for (const cv of cvs) {
      try {
        const result = await this.analyzeCV(tenantId, {
          jobOpeningId,
          cvText: cv.text,
          originalFilename: cv.filename
        });
        results.push({ ...result, filename: cv.filename });
      } catch (error: any) {
        logger.error('Batch CV analysis failed for file', { filename: cv.filename, error: error.message });
        results.push({
          id: uuidv4(),
          filename: cv.filename,
          clasificacion: 'descartado',
          razonamiento: `Error procesando archivo: ${error.message}`,
          datos_extraidos: { nombre: '', correo: '', telefono: '', anos_experiencia: 0, habilidades_tecnicas: [], educacion_superior: '' },
          match_score: 0,
          missing_requirements: ['Error de procesamiento']
        });
      }
    }

    return results;
  }

  static getCVAnalysisResults(tenantId: string, jobOpeningId: string, classificationFilter: string | undefined, minScore?: number): any[] {
    let query = 'SELECT * FROM cv_analyses WHERE tenant_id = ? AND job_opening_id = ?';
    const params: any[] = [tenantId, jobOpeningId];

    if (classificationFilter) {
      query += ' AND classification = ?';
      params.push(classificationFilter);
    }

    if (minScore !== undefined) {
      query += ' AND match_score >= ?';
      params.push(minScore);
    }

    query += ' ORDER BY match_score DESC, created_at DESC';

    return db.prepare(query).all(...params);
  }

  static getAnalysisById(tenantId: string, analysisId: string): any {
    return db.prepare('SELECT * FROM cv_analyses WHERE id = ? AND tenant_id = ?').get(analysisId, tenantId);
  }

  static linkToCandidate(tenantId: string, analysisId: string, candidateId: string): boolean {
    const result = db.prepare(
      'UPDATE cv_analyses SET candidate_id = ? WHERE id = ? AND tenant_id = ?'
    ).run(candidateId, analysisId, tenantId);
    return result.changes > 0;
  }

  private static validateAndNormalizeResult(parsed: any, cvText: string): CVAnalysisResult {
    const validClassifications = ['elegible', 'descartado'];
    const classification = validClassifications.includes(parsed.clasificacion) ? parsed.clasificacion : 'descartado';

    return {
      clasificacion: classification,
      razonamiento: parsed.razonamiento || 'Análisis automático completado',
      datos_extraidos: {
        nombre: parsed.datos_extraidos?.nombre || 'N/A',
        correo: parsed.datos_extraidos?.correo || 'N/A',
        telefono: parsed.datos_extraidos?.telefono || 'N/A',
        anos_experiencia: typeof parsed.datos_extraidos?.anos_experiencia === 'number' ? parsed.datos_extraidos.anos_experiencia : 0,
        habilidades_tecnicas: Array.isArray(parsed.datos_extraidos?.habilidades_tecnicas) ? parsed.datos_extraidos.habilidades_tecnicas.slice(0, 8) : [],
        educacion_superior: parsed.datos_extraidos?.educacion_superior || 'N/A'
      },
      match_score: typeof parsed.match_score === 'number' ? Math.max(0, Math.min(100, parsed.match_score)) : 0,
      missing_requirements: Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements : []
    };
  }

  private static fallbackAnalysis(cvText: string, jobData: any): CVAnalysisResult {
    const emailMatch = cvText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = cvText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const yearMatches = cvText.match(/\b(20\d{2}|19\d{2})\b/g);
    const techKeywords = ['javascript', 'typescript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 'go', 'rust', 'c#', '.net', 'php', 'laravel', 'vue', 'angular', 'swift', 'kotlin', 'flutter', 'postgresql', 'mongodb', 'redis', 'graphql', 'rest', 'api', 'microservicios', 'ci/cd', 'git', 'linux', 'agile', 'scrum'];
    const foundSkills = techKeywords.filter(skill => cvText.toLowerCase().includes(skill.toLowerCase()));

    let anosExp = 0;
    if (yearMatches && yearMatches.length >= 2) {
      const years = yearMatches.map(Number).sort((a, b) => a - b);
      anosExp = years[years.length - 1] - years[0];
    }

    const hasValidContact = emailMatch && phoneMatch;
    const hasExperience = anosExp >= 1;
    const hasSkills = foundSkills.length >= 3;
    const hasText = cvText.trim().length > 80;

    const clasificacion: 'elegible' | 'descartado' = hasValidContact && hasExperience && hasSkills && hasText ? 'elegible' : 'descartado';

    let razonamiento = '';
    if (!hasValidContact) razonamiento += 'Faltan contactos válidos. ';
    if (!hasExperience) razonamiento += 'Experiencia insuficiente (<1 año). ';
    if (!hasSkills) razonamiento += `Pocas habilidades técnicas (${foundSkills.length}/3). `;
    if (!hasText) razonamiento += 'Texto extraído muy corto. ';
    if (!razonamiento) razonamiento = 'Cumple criterios básicos de elegibilidad.';

    const requiredSkills = (jobData.required_skills || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const missing = requiredSkills.filter((req: string) => !foundSkills.some(fs => fs.toLowerCase().includes(req) || req.includes(fs.toLowerCase())));

    return {
      clasificacion,
      razonamiento: razonamiento.trim(),
      datos_extraidos: {
        nombre: 'N/A',
        correo: emailMatch?.[0] || 'N/A',
        telefono: phoneMatch?.[0] || 'N/A',
        anos_experiencia: anosExp,
        habilidades_tecnicas: foundSkills.slice(0, 8),
        educacion_superior: 'N/A'
      },
      match_score: hasValidContact && hasExperience && hasSkills ? 65 : 25,
      missing_requirements: missing.slice(0, 5)
    };
  }
}