// ============================================================
// Provedor Local — Busca nos leads já armazenados no Firestore
// Dados previamente coletados dos scrapers DOE-SP e CETESB
// ============================================================

import { adminDb } from '@/lib/firebase/admin';
import { SearchResult, ParsedIntent, SearchFilters } from './types';

/** Extrai telefone via RegEx simples */
function extractPhone(text: string): boolean {
  const phoneRegex = /(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))/g;
  return phoneRegex.test(text);
}

/** Extrai email via RegEx simples */
function extractEmail(text: string): boolean {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  return emailRegex.test(text);
}

/** Converte um documento Firestore em SearchResult normalizado */
function normalizeFirestoreLead(id: string, data: Record<string, unknown>): SearchResult {
  const fonteTxt = String(data.fonteOriginal || '');
  
  const fonte = (() => {
    if (fonteTxt.includes('DOE') || fonteTxt.includes('Diário')) return 'DOE-SP' as const;
    if (fonteTxt.includes('CETESB')) return 'CETESB' as const;
    return 'DOE-SP' as const;
  })();

  const textoBruto = String(data.textoBruto || data.fonteOriginal || '');
  const estagio = String(data.estagio || 'Lead Novo');
  
  // Detecção de contato e alvará
  const temContato = extractPhone(textoBruto) || extractEmail(textoBruto);
  const temAlvara = estagio.toLowerCase().includes('alvará') || estagio.toLowerCase().includes('aprovado') || estagio.toLowerCase().includes('prévia');

  return {
    id: `local_${id}`,
    fonte,
    titulo: String(data.obra || 'Obra não identificada'),
    descricao: textoBruto.substring(0, 300) + '...',
    orgao: String(data.construtora || 'Não identificada'),
    empresa: String(data.construtora || ''),
    cidade: String(data.cidade || ''),
    uf: 'SP', // scrapers atuais são de SP
    fase: estagio,
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
    tem_contato: temContato,
    tem_alvara: temAlvara,
  };
}

export async function searchLocal(
  intent: ParsedIntent,
  filters: SearchFilters
): Promise<SearchResult[]> {
  try {
    const leadsRef = adminDb.collection('leads');
    const dias = filters.dias || 90; // Lookback maior na base local B2B
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    // Pegamos os últimos 300 registros para garantir que filtramos bem no lado cliente
    const query = leadsRef.orderBy('criadoEm', 'desc').limit(300);
    const snapshot = await query.get();

    if (snapshot.empty) return [];

    const results: SearchResult[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const searchableText = [
        data.obra,
        data.construtora,
        data.cidade,
        data.endereco_aproximado,
        data.textoBruto,
      ].filter(Boolean).join(' ').toLowerCase();

      // B2B MATCHING RULE:
      // Se não houver keywords específicas E não houver região, match de tudo.
      // Se houver região, match se bater com a região.
      // Se houver keywords, tenta match com keywords.
      
      let regionMatched = false;
      if (intent.region) {
        const regionLower = intent.region.toLowerCase();
        const cidadeLower = String(data.cidade || '').toLowerCase();
        const enderecoLower = String(data.endereco_aproximado || '').toLowerCase();
        
        regionMatched = cidadeLower.includes(regionLower) || 
                        enderecoLower.includes(regionLower) || 
                        regionLower.includes(cidadeLower);
      } else {
        // Se o usuário não definiu cidade, aceitamos como matched geographicamente.
        regionMatched = true; 
      }

      let keywordMatched = false;
      if (intent.keywords.length > 0) {
        // Ignora keywords obvias demais que podem bloquear alvarás (ex: "obra")
        const filteredKeywords = intent.keywords.filter(k => k.toLowerCase() !== 'obra' && k.toLowerCase() !== 'sp');
        
        if (filteredKeywords.length === 0) {
           keywordMatched = true;
        } else {
           keywordMatched = filteredKeywords.some(kw => searchableText.includes(kw.toLowerCase()));
        }
      } else {
        keywordMatched = true;
      }

      // Requisito B2B Flexível: Para leads privados de alto valor, se a região bateu, vale a pena 
      // trazer MESMO QUE a keyword exata não tenha batido (ex: buscou "saneamento", mas tem um Alvará enorme).
      // Vamos trazer para o ranker e deixar ele decidir.
      if (!regionMatched && !keywordMatched) {
        continue;
      }

      // Ignorar leads da Places (velha API de rua)
      if (String(data.fonteOriginal || '').includes('Places')) continue;

      results.push(normalizeFirestoreLead(doc.id, data));
    }

    return results.slice(0, 100);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Local] Firestore search error: ${msg}`);
    return [];
  }
}
