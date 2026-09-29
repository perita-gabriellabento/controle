export const metadata = {
  title: 'Política de Privacidade | Controle de Perícias',
  robots: 'noindex, nofollow',
}

export default function PrivacidadePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'Montserrat, sans-serif', lineHeight: 1.7, color: '#1a1a1a', background: '#FAF7F1', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 28, marginBottom: 8 }}>Política de Privacidade</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 32 }}>Controle de Perícias — última atualização: 28/09/2026</p>

      <p>
        Este é um sistema de uso pessoal e exclusivo de <strong>Gabriella Bento de Oliveira</strong>,
        Perita Contábil (CRC/GO nº 028466/O-5), para gestão de seus próprios processos periciais judiciais.
        Não é um serviço oferecido a terceiros.
      </p>

      <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, marginTop: 32, marginBottom: 8 }}>Acesso ao Google Calendar</h2>
      <p>
        O aplicativo solicita acesso ao Google Agenda exclusivamente para <strong>criar, atualizar e remover
        eventos</strong> relacionados aos prazos processuais dos processos periciais da própria usuária
        (data de início, entrega prevista e prazos legais de cada fase). O aplicativo <strong>nunca lê</strong> o
        conteúdo do calendário, não acessa outros eventos já existentes, e não compartilha, vende ou usa
        esses dados para qualquer finalidade além da descrita acima.
      </p>

      <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, marginTop: 32, marginBottom: 8 }}>Dados armazenados</h2>
      <p>
        Os dados dos processos periciais (partes, número do processo, honorários, prazos, checklist de
        tarefas) ficam armazenados em banco de dados privado, protegido por autenticação, acessível apenas
        pela própria usuária mediante login pessoal. Nenhum dado é compartilhado com terceiros.
      </p>

      <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: 18, marginTop: 32, marginBottom: 8 }}>Contato</h2>
      <p>
        Dúvidas sobre esta política podem ser enviadas para{' '}
        <a href="mailto:bentogabriella97@gmail.com" style={{ color: '#8C6314' }}>bentogabriella97@gmail.com</a>.
      </p>
    </div>
  )
}
