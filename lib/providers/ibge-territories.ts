// ============================================================
// Mapa de Cidades SP → Código IBGE (territory_id)
// Usado pelo provedor Querido Diário para filtrar por município
// ============================================================

/** Municípios de SP com maior volume de obras (código IBGE de 7 dígitos) */
export const SP_TERRITORIES: Record<string, string> = {
  'são paulo': '3550308',
  'guarulhos': '3518800',
  'campinas': '3509502',
  'são bernardo do campo': '3548708',
  'santo andré': '3547809',
  'osasco': '3534401',
  'são josé dos campos': '3549904',
  'ribeirão preto': '3543402',
  'sorocaba': '3552205',
  'santos': '3548500',
  'são josé do rio preto': '3549805',
  'mauá': '3529401',
  'diadema': '3513801',
  'jundiaí': '3525904',
  'piracicaba': '3538709',
  'carapicuíba': '3510609',
  'bauru': '3506003',
  'itaquaquecetuba': '3523107',
  'mogi das cruzes': '3530706',
  'franca': '3516200',
  'suzano': '3552502',
  'taboão da serra': '3552809',
  'limeira': '3526902',
  'praia grande': '3541000',
  'são vicente': '3551009',
  'barueri': '3505708',
  'taubaté': '3554102',
  'cotia': '3513009',
  'indaiatuba': '3520509',
  'presidente prudente': '3541406',
  'araraquara': '3503208',
  'marília': '3529005',
  'são carlos': '3548906',
  'americana': '3501608',
  'são caetano do sul': '3548807',
  'jacareí': '3524402',
  'itapevi': '3522505',
  'hortolândia': '3519071',
  'sumaré': '3552403',
  'santa bárbara d\'oeste': '3545803',
  'embu das artes': '3515004',
  'guarujá': '3518701',
  'atibaia': '3504107',
  'cubatão': '3513504',
  'valinhos': '3556206',
  'vinhedo': '3556701',
  'paulínia': '3536505',
  'itatiba': '3523602',
  'bragança paulista': '3507605',
  'araçatuba': '3502804',
  'ferraz de vasconcelos': '3515707',
  'franco da rocha': '3516309',
  'são roque': '3550100',
  'itu': '3523909',
  'salto': '3545209',
  'botucatu': '3507506',
  'registro': '3542602',
  'caraguatatuba': '3510500',
  'são sebastião': '3550704',
  'ilhabela': '3520400',
  'ubatuba': '3555406',
  'bertioga': '3506359',
  'mongaguá': '3531100',
  'itanhaém': '3522109',
  'peruíbe': '3537602',
};

/**
 * Resolve o nome de uma cidade para o territory_id do IBGE.
 * Retorna undefined se não encontrar (busca será feita sem filtro de território).
 */
export function resolveTerritoryId(cityName: string): string | undefined {
  if (!cityName) return undefined;
  const normalized = cityName.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Tentar match direto primeiro
  for (const [city, id] of Object.entries(SP_TERRITORIES)) {
    const normalizedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedCity === normalized || normalizedCity.includes(normalized) || normalized.includes(normalizedCity)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Retorna os territory_ids das maiores cidades de SP para busca ampla.
 * Usado quando a query não especifica uma cidade.
 */
export function getTopSPTerritories(count = 10): string[] {
  // As 10 maiores cidades de SP por população (mais obras)
  return [
    '3550308', // São Paulo
    '3518800', // Guarulhos
    '3509502', // Campinas
    '3548708', // São Bernardo do Campo
    '3547809', // Santo André
    '3534401', // Osasco
    '3549904', // São José dos Campos
    '3543402', // Ribeirão Preto
    '3552205', // Sorocaba
    '3548500', // Santos
  ].slice(0, count);
}
