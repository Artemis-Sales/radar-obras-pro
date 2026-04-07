/**
 * geocode.mjs
 * Módulo utilitário de Geocodificação via Google Geocoding API.
 * Converte um endereço textual em coordenadas geográficas (lat/lng) precisas.
 *
 * A chave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY é a mesma usada no frontend —
 * a Google Maps Platform usa uma única chave por projeto para todas as APIs Maps.
 */

/**
 * Geocodifica um endereço e retorna { lat, lng } ou null se não encontrar.
 * @param {string} endereco - Endereço completo ou cidade para geocodificar.
 * @param {string} apiKey - Chave da Google Maps / Geocoding API.
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodeAddress(endereco, apiKey) {
  if (!endereco || !apiKey) {
    console.warn('⚠️ Geocodificação ignorada: endereço ou chave ausentes.');
    return null;
  }

  // Acrescenta "São Paulo, Brasil" como bias regional para melhorar a precisão
  // quando o endereço for apenas nome de cidade (ex: "Osasco")
  const enderecoNormalizado = endereco.includes('SP') || endereco.includes('São Paulo')
    ? `${endereco}, Brasil`
    : `${endereco}, São Paulo, Brasil`;

  const encodedAddress = encodeURIComponent(enderecoNormalizado);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&region=br&language=pt-BR`;

  try {
    // Node.js 18+ e Node.js 20 (GitHub Actions) têm fetch nativo como global
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`📍 Geocodificado: "${enderecoNormalizado}" → lat: ${lat}, lng: ${lng}`);
      return { lat, lng };
    }

    if (data.status === 'ZERO_RESULTS') {
      console.warn(`⚠️ Geocoding: Nenhum resultado para "${enderecoNormalizado}". Status: ${data.status}`);
    } else {
      console.error(`❌ Geocoding API retornou erro: ${data.status} - ${data.error_message || ''}`);
    }

    return null;
  } catch (error) {
    console.error('❌ Falha na chamada à Google Geocoding API:', error.message);
    return null;
  }
}

/**
 * Monta a melhor string de endereço possível a partir dos dados do lead extraídos pelo Gemini.
 * Prioridade: endereço completo > cidade > fallback SP.
 * @param {object} leadData - Objeto com campos { endereco_aproximado, cidade }
 * @returns {string}
 */
export function buildAddressString(leadData) {
  const partes = [];

  if (leadData.endereco_aproximado && leadData.endereco_aproximado.trim().length > 3) {
    partes.push(leadData.endereco_aproximado.trim());
  }

  if (leadData.cidade && leadData.cidade.trim().length > 0) {
    partes.push(leadData.cidade.trim());
  }

  if (partes.length === 0) {
    return 'São Paulo, SP';
  }

  return partes.join(', ');
}
