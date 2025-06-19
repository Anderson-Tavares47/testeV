const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rotas
const solicitantesRoutes = require('./routes/solicitantes');
const usuariosRoutes = require('./routes/usuarios');
const demandasRoutes = require('./routes/demandas');

app.use('/solicitantes', solicitantesRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/demandas', demandasRoutes);

// Porta
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
