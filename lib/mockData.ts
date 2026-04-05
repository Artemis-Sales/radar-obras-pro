export interface Obra {
  id: string;
  obra: string;
  construtora: string;
  cidade: string;
  endereco_aproximado: string;
  estagio: 'Lead Novo' | 'Tentativa de Contato' | 'Em Negociação' | 'Descartado' | 'Fechado';
  lat: number;
  lng: number;
}

export const mockObras: Obra[] = [
  {
    id: '1',
    obra: 'Condomínio Residencial Jardins',
    construtora: 'Construtora Alpha',
    cidade: 'São Paulo',
    endereco_aproximado: 'Av. Brigadeiro Faria Lima, 1000 - Itaim Bibi',
    estagio: 'Lead Novo',
    lat: -23.5857,
    lng: -46.6787
  },
  {
    id: '2',
    obra: 'Edifício Comercial Paulista',
    construtora: 'Beta Engenharia',
    cidade: 'São Paulo',
    endereco_aproximado: 'Av. Paulista, 1578 - Bela Vista',
    estagio: 'Tentativa de Contato',
    lat: -23.5614,
    lng: -46.6560
  },
  {
    id: '3',
    obra: 'Loteamento Parque das Estrelas',
    construtora: 'Gama Empreendimentos',
    cidade: 'Campinas',
    endereco_aproximado: 'Rodovia D. Pedro I, km 130',
    estagio: 'Em Negociação',
    lat: -22.8464,
    lng: -46.9922
  }
];
