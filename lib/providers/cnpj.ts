// ============================================================
// BrasilAPI — Consulta CNPJ (100% Gratuito)
// Docs: https://brasilapi.com.br/docs#tag/CNPJ
// ============================================================

export interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  porte: string; // 'MEI' | 'ME' | 'EPP' | 'DEMAIS'
  capital_social: number;
  natureza_juridica: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  situacao_cadastral: string; // 'ATIVA', 'BAIXADA', etc.
  logradouro: string;
  numero: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone_1: string | null;
  email: string | null;
  socios: Array<{
    nome: string;
    qualificacao: string;
  }>;
}

/**
 * Consulta CNPJ na BrasilAPI (gratuito, sem auth).
 * Rate limit: ~3 req/s. Retorna null se falhar.
 */
export async function lookupCNPJ(cnpj: string): Promise<CNPJData | null> {
  // Limpar CNPJ — apenas dígitos
  const cleanCnpj = cnpj.replace(/\D/g, '');
  
  if (cleanCnpj.length !== 14) {
    console.warn(`[CNPJ] CNPJ inválido: ${cnpj}`);
    return null;
  }

  try {
    const res = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000), // 10s timeout
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        console.log(`[CNPJ] Não encontrado: ${cleanCnpj}`);
      } else if (res.status === 429) {
        console.warn(`[CNPJ] Rate limit atingido`);
      } else {
        console.error(`[CNPJ] HTTP ${res.status} para ${cleanCnpj}`);
      }
      return null;
    }

    const data = await res.json();
    
    return {
      cnpj: data.cnpj || cleanCnpj,
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || null,
      porte: mapPorte(data.porte),
      capital_social: data.capital_social || 0,
      natureza_juridica: data.natureza_juridica || '',
      cnae_fiscal: data.cnae_fiscal || 0,
      cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
      situacao_cadastral: mapSituacao(data.descricao_situacao_cadastral),
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
      cep: data.cep || '',
      telefone_1: data.ddd_telefone_1 || null,
      email: data.email || null,
      socios: Array.isArray(data.qsa)
        ? data.qsa.map((s: Record<string, string>) => ({
            nome: s.nome_socio || s.nome || '',
            qualificacao: s.qualificacao_socio || s.qual || '',
          }))
        : [],
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CNPJ] Fetch error: ${msg}`);
    return null;
  }
}

function mapPorte(porte: string | number): string {
  const p = String(porte).toUpperCase();
  if (p.includes('MEI') || p === '01') return 'MEI';
  if (p.includes('ME') || p.includes('MICRO') || p === '01') return 'ME';
  if (p.includes('EPP') || p.includes('PEQUENO') || p === '03') return 'EPP';
  if (p.includes('MEDIO') || p === '05') return 'Médio';
  if (p.includes('GRANDE') || p.includes('DEMAIS')) return 'Grande';
  return p || 'Não informado';
}

function mapSituacao(situacao: string): string {
  if (!situacao) return 'Desconhecida';
  return situacao;
}
