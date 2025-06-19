const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// Criar
// router.post('/', async (req, res) => {
//   try {
//     const {
//       protocolo,
//       setor,
//       prioridade,
//       status,
//       dataSolicitacao,
//       dataTermino,
//       solicitant,
//       nomeCompleto,
//       cpf,
//       reincidencia,
//       meioSolicitacao,
//       anexarDocumentos,
//       envioCobranca1,
//       envioCobranca2,
//       envioParaResponsavel,
//       observacoes,
//       solicitantId
//     } = req.body;

//     // Verificar se o solicitante existe na tabela correta
//     const solicitanteExistente = await prisma.solicitantes_unicos.findUnique({
//       where: { id: parseInt(solicitantId) }
//     });

//     if (!solicitanteExistente) {
//       return res.status(400).json({ error: 'Solicitante não encontrado' });
//     }

//     // Criar a demanda
//     const novaDemanda = await prisma.demandas.create({
//       data: {
//         protocolo,
//         setor,
//         prioridade,
//         status,
//         dataSolicitacao: dataSolicitacao ? new Date(dataSolicitacao) : new Date(),
//         dataTermino: dataTermino ? new Date(dataTermino) : null,
//         solicitant,
//         nomeCompleto,
//         cpf,
//         reincidencia,
//         meioSolicitacao,
//         anexarDocumentos,
//         envioCobranca1,
//         envioCobranca2,
//         envioParaResponsavel,
//         observacoes,
//         solicitanteId: parseInt(solicitantId) // usando o nome correto do campo
//       }
//     });

//     res.json(novaDemanda);
//   } catch (error) {
//     console.error('Erro detalhado:', error);
//     res.status(500).json({ 
//       error: 'Erro ao criar demanda',
//       detalhe: error.message
//     });
//   }
// });

router.post('/', async (req, res) => {
  try {
    const {
      protocolo,
      setor,
      prioridade,
      status,
      dataSolicitacao,
      dataTermino,
      solicitant,
      reincidencia,
      meioSolicitacao,
      anexarDocumentos,
      envioCobranca1,
      envioCobranca2,
      envioParaResponsavel,
      observacoes,
      solicitantId
    } = req.body;

    console.log(req.body, '===============')

    // 1. Verificar se o solicitante existe
    const solicitanteExistente = await prisma.solicitantes_unicos.findUnique({
      where: { id: parseInt(solicitantId) }
    });

    if (!solicitanteExistente) {
      return res.status(400).json({ 
        error: 'Solicitante não encontrado',
        details: `Nenhum solicitante encontrado com o ID: ${solicitantId}`
      });
    }

    // 2. Mapear valores para os enums corretos
    const reincidenciaEnum = reincidencia === 'N_o' ? 'N_o' : 'Sim';
    const meioSolicitacaoEnum = meioSolicitacao === 'WhatsApp' ? 'WhatsApp' : 'Presencial';
    const statusEnum = status === 'Aguardando_Retorno' ? 'Aguardando_Retorno' :
                      status === 'Conclu_da' ? 'Conclu_da' : 
                      status === 'Cancelada' ? 'Cancelada' : 'Pendente';

    // 3. Criar a demanda
    const novaDemanda = await prisma.demandas.create({
      data: {
        protocolo,
        setor,
        prioridade,
        status: statusEnum,
        dataSolicitacao: dataSolicitacao ? new Date(dataSolicitacao) : new Date(),
        dataTermino: dataTermino ? new Date(dataTermino) : null,
        solicitant,
        reincidencia: reincidenciaEnum,
        meioSolicitacao: meioSolicitacaoEnum,
        anexarDocumentos,
        envioCobranca1,
        envioCobranca2,
        envioParaResponsavel,
        observacoes,
        solicitanteId: parseInt(solicitantId)
      }
    });

    res.json(novaDemanda);
  } catch (error) {
    console.error('Erro detalhado:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    let errorMessage = 'Erro ao criar demanda';
    if (error.code === 'P2003') {
      errorMessage = 'Erro de relacionamento: O solicitante informado não existe';
    } else if (error.code === 'P2002') {
      errorMessage = 'Violação de restrição única: Protocolo já existe';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
});
// Buscar próximo protocolo
router.get('/proximo-protocolo', async (req, res) => {
  const ultima = await prisma.demandas.findFirst({
    orderBy: { id: 'desc' }
  });

  const ano = new Date().getFullYear();
  const sequencial = (ultima?.id || 0) + 1;
  const protocolo = `P${ano}${String(sequencial).padStart(4, '0')}`;

  res.json({ protocolo });
});

//Listar
router.get('/', async (req, res) => {
  try {
    const { id } = req.query;

    const where = id
      ? { solicitanteId: parseInt(id) }
      : undefined;

    const lista = await prisma.demandas.findMany({
      where,
      include: { solicitantes: true },
    });

    console.log(id ? `Filtrando por solicitanteId: ${id}` : 'Buscando todas as demandas');

    res.json(lista);
  } catch (error) {
    console.error('Erro ao buscar demandas:', error);
    res.status(500).json({ error: 'Erro ao buscar demandas' });
  }
});


// Buscar por ID
router.get('/:id', async (req, res) => {
  try {
    const solicitante = await prisma.solicitantes_unicos.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!solicitante) {
      return res.status(404).json({ error: 'Solicitante não encontrado' });
    }

    res.json(solicitante);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar solicitante', detalhe: error.message });
  }
});





// Atualizar
router.put('/:id', async (req, res) => {
  const item = await prisma.demandas.update({
    where: { id: parseInt(req.params.id) },
    data: req.body
  });
  res.json(item);
});

// Deletar
router.delete('/:id', async (req, res) => {
  await prisma.demandas.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ deleted: true });
});

module.exports = router;
