const { Pool } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
require("dotenv").config();
const chainIds = require('./chain_names.json');
const app = express();
const cors = require('cors'); // Esta línea fue agregada
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.PORT_GRAPH || 3003;

app.use(cors({
  origin: ['https://ggeese.github.io', 'https://goosey.fun'] // Restringe los orígenes permitidos
  //origin: 'http://localhost:5173', // Restringe los orígenes permitidos
}));

// Crea una instancia del cliente PostgreSQL con opciones de SSL/TLS
/*const pool  = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'DegenSQL',
  password: '1M3M323_3-152G0553XD##',
  port: 5432,
});*/


const pool  = new Pool({
  user: process.env.USER_POSTGRES,
  host: process.env.HOST_DB_POSTGRES,
  database: process.env.DATABASE_DB_POSTGRES,
  password: process.env.PASSWORD_DB_POSTGRES,
  port: process.env.PORT_DB_POSTGRES,
});


pool.connect()
  .then(client => {
    console.log('Conectado a la base de datos PostgreSQL');
    client.release(); // Liberamos la conexión inicial
  })
  .catch(err => console.error('Error al conectar a la base de datos PostgreSQL', err));

let lastData = null;

const fetchData = async (tableName, chainNet) => {
  if (!tableName || !chainNet) return null;

  const chainAbbr = chainIds[chainNet];
  const fullTableName = `${chainAbbr}_${tableName}`.toLowerCase();

  try {
    const query = `SELECT * FROM "${fullTableName}" ORDER BY timestamp DESC LIMIT 100`;
    const result = await pool.query(query); // Usamos el pool para hacer la consulta

    const transformedData = result.rows.map(row => {
      const timestamp = Number(row.timestamp);
      return [
        timestamp,
        0,
        row.high,
        row.low,
        row.close,
        row.volume || "0",
        timestamp + 60000,
      ];
    }).sort((a, b) => a[0] - b[0]);

    for (let i = 1; i < transformedData.length; i++) {
      transformedData[i][1] = transformedData[i - 1][4];
    }

    return transformedData;
  } catch (err) {
    console.error(err.stack);
    return null;
  }
};

wss.on('connection', (ws, req) => {
  //const allowedOrigins = ['http://localhost:5173'];
  const allowedOrigins = ['https://goldengcoin.github.io'];
  const origin = req.headers.origin;
  if (!allowedOrigins.includes(origin)) {
    ws.terminate();
    console.log('Conexión rechazada desde origen no permitido:', origin);
    return;
  }

  console.log('Nuevo cliente conectado');
  let tableName, chainNet;

  ws.on('message', async (message) => {
    const { tableName: newTableName, chainNet: newChainNet } = JSON.parse(message);

    if (!newTableName || !/^[a-zA-Z0-9_]+$/.test(newTableName)) {
      ws.send(JSON.stringify({ error: 'Nombre de tabla inválido' }));
      return;
    }

    const chainAbbr = chainIds[newChainNet];
    if (!chainAbbr) {
      ws.send(JSON.stringify({ error: 'Red inválida' }));
      return;
    }

    tableName = newTableName;
    chainNet = newChainNet;

    // Fetch initial data
    const initialData = await fetchData(tableName, chainNet);
    if (initialData) {
      lastData = initialData;
      ws.send(JSON.stringify(initialData));
    }
  });

  const sendData = async () => {
    const data = await fetchData(tableName, chainNet);

    if (data && JSON.stringify(data) !== JSON.stringify(lastData)) {
      lastData = data;
      ws.send(JSON.stringify(data));
    }
  };

  const interval = setInterval(sendData, 60000);

  ws.on('close', () => {
    console.log('Cliente desconectado');
    clearInterval(interval);
  });
});

server.listen(port, () => {
  console.log(`Servidor iniciado en el puerto ${port}`);
});
