import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function runMaestro() {
  console.log('======================================================');
  console.log('🔄 Iniciando Varredura Diária de Obras...');
  console.log('======================================================\n');

  // Optamos por invocar via Processos Isolados (Child Process) ao invés de import direto.
  // Motivo arquitetural (Estabilidade do Cron): Se um dos robôs Puppeteer travar o navegador
  // Chrome por falta de memória ou crashar a página, o processo filho morre, mas o Maestro sobrevive.
  const scrapers = [
    { name: 'Motor CETESB (Licenças Prévias e Instalação)', path: 'node scripts/scraper-cetesb.mjs' },
    { name: 'Motor Diário Oficial SP (GRAPROHAB)', path: 'node scripts/scraper-doe.mjs' },
    { name: 'Motor Prefeitura SP (Alvarás Municipais)', path: 'node scripts/scraper-prefeitura.mjs' }
  ];

  // A execução é SEQUENCIAL genérica, para conservar RAM no servidor de hospedagem no momento do CRON.
  for (const scraper of scrapers) {
    console.log(`▶️ Acionando ${scraper.name}...`);
    try {
      const { stdout, stderr } = await execPromise(scraper.path);
      
      console.log(`✅ ${scraper.name} finalizou perfeitamente!`);
      // Ocultamos os logs gigantas de sucesso pra tela não ficar poluída, mas pode habilitar:
      // console.log(`--- ÚLTIMAS SAÍDAS ---\n${stdout.substring(stdout.length - 500)}...\n`);
      
      if (stderr) {
        console.warn(`⚠️ Atenção/Warns (${scraper.name}):\n${stderr}`);
      }
    } catch (error) {
      console.error(`\n❌ FALHA CRÍTICA detectada em [${scraper.name}].`);
      console.error(`O site pode estar fora do ar ou o seletor mudou. Detalhes do Erro:`);
      console.error(error.message);
      console.error('\n⏭️ Isolando falha e prosseguindo para o próximo robô da fila...\n');
      
      // Aqui seria o local ideal para plugar uma API de envio de E-mail pro dono da plataforma avisando a falha.
    }
    console.log('------------------------------------------------------');
  }

  console.log('======================================================');
  console.log('✅ Varredura Diária Concluída!');
  console.log('======================================================');
}

runMaestro();
