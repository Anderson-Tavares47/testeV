const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const router = express.Router();

const prisma = new PrismaClient();
const saltRounds = 10;
const jwt = require('jsonwebtoken')

// const authMiddleware = require('../../middlewares/auth');
// router.use(authMiddleware);

const SECRET = process.env.JWT_SECRET || 'PjTeste'

// Registrar novo solicitante
router.post('/register', async (req, res) => {
  const { cpf, senha, ...dados } = req.body;

  if (!cpf || !senha) {
    return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
  }

  try {
    const existenteUnico = await prisma.solicitantes_unicos.findFirst({ where: { cpf } });
    const senhaHash = await bcrypt.hash(senha, saltRounds);

    let solicitanteUnicoId;

    if (existenteUnico) {
      await prisma.solicitantes_unicos.update({
        where: { id: existenteUnico.id },
        data: { senha: senhaHash }
      });
      solicitanteUnicoId = existenteUnico.id;
    } else {
      const novoUnico = await prisma.solicitantes_unicos.create({
        data: {
          cpf,
          senha: senhaHash,
          ...dados
        }
      });
      solicitanteUnicoId = novoUnico.id;
    }

    // Cria na tabela de solicitantes com o mesmo ID do solicitantes_unicos
    const novoSolicitante = await prisma.solicitantes.create({
      data: {
        id: solicitanteUnicoId, // mesmo id da tabela de unicos
        cpf,
        ...dados
      }
    });

    return res.json({
      message: 'Solicitante registrado com sucesso',
      solicitante: novoSolicitante
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar/login', detalhe: error.message });
  }
});



// Login
// router.post('/login', async (req, res) => {
//   const { email, senha } = req.body

//   if (!email || !senha) {
//     return res.status(400).json({ error: 'E-mail ou CPF e senha são obrigatórios' })
//   }

//   try {
//     const solicitante = await prisma.solicitantes_unicos.findFirst({
//       where: {
//         OR: [{ email }, { cpf: email }]
//       }
//     })

//     if (!solicitante || !solicitante.senha) {
//       return res.status(404).json({ error: 'Solicitante não encontrado' })
//     }

//     const senhaOk = await bcrypt.compare(senha, solicitante.senha)

//     if (!senhaOk) {
//       return res.status(401).json({ error: 'Senha incorreta' })
//     }

//     const token = jwt.sign( { id: solicitante.id, cpf: solicitante.cpf, adm: solicitante.adm }, SECRET, {
//       expiresIn: '1d'
//     })

//     return res.json({
//       message: 'Login realizado com sucesso',
//       solicitante,
//       token
//     })
//   } catch (error) {
//     return res.status(500).json({ error: 'Erro ao autenticar', detalhe: error.message })
//   }
// })

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  // Validação dos campos de entrada
  if (!email || !senha) {
    return res.status(400).json({ 
      error: 'Credenciais obrigatórias',
      message: 'E-mail/CPF e senha são obrigatórios para login' 
    });
  }

  try {
    // 1. Primeiro tenta encontrar como usuário (apenas por email)
    let user = await prisma.usuarios.findUnique({
      where: { 
        email: email.toLowerCase().trim() 
      },
      select: { // Adicione esta parte
        id: true,
        nome: true,
        email: true,
        senha: true,
        empresa: true,
        rule: true,
        setorId: true,
        adm: true, // Garante que o campo será retornado
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(user, 'user')

    let tipo = 'usuario';

    // 2. Se não encontrou como usuário, tenta como solicitante (por email ou CPF)
    if (!user) {
      user = await prisma.solicitantes_unicos.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase().trim() },
            { cpf: email.replace(/\D/g, '') } // Remove não-números do CPF
          ]
        }
      });
      tipo = 'solicitante';
    }

    // 3. Se não encontrou em nenhuma tabela
    if (!user) {
      return res.status(404).json({ 
        error: 'Credenciais inválidas',
        message: 'Nenhuma conta encontrada com este e-mail/CPF' 
      });
    }

    // 4. Verifica se a senha existe (para casos onde o usuário pode não ter senha)
    if (!user.senha) {
      return res.status(401).json({ 
        error: 'Configuração incompleta',
        message: 'Este usuário não possui senha definida' 
      });
    }

    // 5. Compara a senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        message: 'Senha incorreta' 
      });
    }

    console.log(user, 'user aqui')

    // 6. Remove a senha do objeto de usuário antes de retornar
    const { senha: _, ...userSemSenha } = user;

    // 7. Gera o token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        cpf: user.cpf || null, // Pode ser undefined para usuarios
        adm: user.adm || false, // Assume false se não existir
        tipo
      },
      process.env.JWT_SECRET || SECRET,
      { expiresIn: '1d' }
    );

    // 8. Retorna resposta de sucesso
    return res.json({
      success: true,
      message: 'Login realizado com sucesso',
      usuario: userSemSenha,
      token,
      tipo
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ 
      error: 'Erro no servidor',
      message: 'Ocorreu um erro durante o login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Listar todos os solicitantes únicos
router.get('/', async (req, res) => {
  const { cpf } = req.query;

  try {
    let lista;

    if (cpf) {
      lista = await prisma.solicitantes_unicos.findMany({
        where: { cpf: String(cpf) }
      });
    } else {
      lista = await prisma.solicitantes_unicos.findMany();
    }

    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar', detalhe: error.message });
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
// Atualizar solicitante
router.put('/:id', async (req, res) => {
  try {
    const {
      nomeCompleto,
      cpf,
      titulo,
      telefoneContato,
      email,
      cep,
      endereco,
      num,
      bairro,
      zona,
      pontoReferencia,
      secaoEleitoral
    } = req.body;

    const dataAtualizada = {
      nomeCompleto,
      cpf,
      titulo,
      telefoneContato,
      email,
      cep,
      endereco,
      num,
      bairro,
      zona,
      pontoReferencia,
      secaoEleitoral
    };

    console.log('Atualizando solicitante ID:', req.params.id, 'com dados:', dataAtualizada);

    const item = await prisma.solicitantes_unicos.update({
      where: { id: parseInt(req.params.id) },
      data: dataAtualizada
    });

    res.json(item);
  } catch (error) {
    console.error('Erro no PUT /solicitantes/:id:', error);
    res.status(500).json({ error: 'Erro ao atualizar', detalhe: error.message });
  }
});



// Deletar
router.delete('/:id', async (req, res) => {
  try {
    await prisma.solicitantes_unicos.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar', detalhe: error.message });
  }
});

module.exports = router;
