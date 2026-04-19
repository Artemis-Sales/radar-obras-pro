// ============================================================
// Provedor Local — Busca nos leads já armazenados no Firestore
// Dados previamente coletados dos scrapers DOE-SP e CETESB
// ============================================================

import { adminDb } from '@/lib/firebase/admin';
import { SearchResult, ParsedIntent, SearchFilters } from './types';

/** Converte um documento Firestore em SearchResult normalizado */
function normalizeFirestoreLead(id: string, data: Record<string, unknown>): SearchResult {
  const fonte = (() => {
    const f = String(data.fonteOriginal || '');
    if (f.includes('DOE') || f.includes('Diário')) return 'DOE-SP' as const;
    if (f.includes('CETESB')) return 'CETESB' as const;
    return 'DOE-SP' as const;
  })();

  return {
    id: `local_${id}`,
    fonte,
    titulo: String(data.obra || 'Obra não identificada'),
    descricao: String(data.textoBruto || data.fonteOriginal || ''),
    orgao: String(data.construtora || 'Não identificada'),
    empresa: String(data.construtora || ''),
    cidade: String(data.cidade || ''),
    uf: 'SP', // scrapers atuais são de SP
    fase: String(data.estagio || 'Lead Novo'),
    data_publicacao: (() => {
      const ts = data.criadoEm || data.createdAt;
      if (ts && typeof ts === 'object' && 'toDate' in ts) {
        return (ts as { toDate: () => Date }).toDate().toISOString();
      }
      if (ts instanceof Date) return ts.toISOString();
      if (typeof ts === 'string') return ts;
      return new Date().toISOString();
    })(),
    url_original: String(data.urlOrigem || ''),
    relevancia: 0,
  };
}

export async function searchLocal(
  intent: ParsedIntent,
  filters: SearchFilters
): Promise<SearchResult[]> {
  try {
    // Buscar leads relevantes no Firestore
    const leadsRef = adminDb.collection('leads');

    // Firestore não suporta full-text search, então fazemos query básica
    // e filtramos no código
    const dias = filters.dias || 90; // Olhar mais para trás na base local
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    let query = leadsRef.orderBy('criadoEm', 'desc').limit(200);

    // Filtro por cidade se especificado
    if (intent.region) {
      // Firestore não faz LIKE, mas podemos filtrar com where para match exato
      // e complementar no código
    }

    const snapshot = await query.get();

    if (snapshot.empty) return [];

    const results: SearchResult[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Filtrar por keywords da query
      const searchableText = [
        data.obra,
        data.construtora,
        data.cidade,
        data.endereco_aproximado,
        data.textoBruto,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // Pelo menos uma keyword deve estar presente
      const matches = intent.keywords.length === 0 || 
        intent.keywords.some(kw => searchableText.includes(kw.toLowerCase()));

      if (!matches) continue;

      // Filtro por região
      if (intent.region) {
        const regionLower = intent.region.toLowerCase();
        const cidadeLower = String(data.cidade || '').toLowerCase();
        const enderecoLower = String(data.endereco_aproximado || '').toLowerCase();
        
        if (!cidadeLower.includes(regionLower) && !enderecoLower.includes(regionLower) && !regionLower.includes(cidadeLower)) {
          continue;
        }
      }

      // Ignorar leads da busca ativa anterior (Places)
      if (String(data.fonteOriginal || '').includes('Places')) continue;

      results.push(normalizeFirestoreLead(doc.id, data));
    }

    return results.slice(0, 50);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Local] Firestore search error: ${msg}`);
    return [];
  }
}
