const { Client } = require('pg');
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
  origin: 'https://goldengcoin.github.io', // Restringe los orígenes permitidos
}));

/*
// Crea una instancia del cliente PostgreSQL con opciones de SSL/TLS
const dbConnection = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'DegenSQL',
  password: '1M3M323_3-152G0553XD##',
  port: 5432,
});
*/

const dbConnection = new Client({
  user: process.env.USER_POSTGRES,
  host: process.env.HOST_DB_POSTGRES,
  database: process.env.DATABASE_DB_POSTGRES,
  password: process.env.PASSWORD_DB_POSTGRES,
  port: process.env.PORT_DB_POSTGRES,
});

dbConnection.connect()
  .then(() => console.log('Conectado a la base de datos PostgreSQL'))
  .catch(err => console.error('Error al conectar a la base de datos PostgreSQL', err));


// Configuración del WebSocket para el frontend
wss.on('connection', (ws) => {
  console.log('Nuevo cliente conectado');

  ws.on('message', async (message) => {
    //console.log('Mensaje recibido:', message);
    const { tableName, chainNet } = JSON.parse(message);

    if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      ws.send(JSON.stringify({ error: 'Nombre de tabla inválido' }));
      return;
    }

    // Obtener la abreviatura de la red desde el JSON
    const chainAbbr = chainIds[chainNet];
    if (!chainAbbr) {
      ws.send(JSON.stringify({ error: 'Red inválida' }));
      return;
    }

    // Formar el nombre completo de la tabla
    const fullTableName = `${chainAbbr}_${tableName}`;
    console.log(fullTableName,"nombre tabla busqueda")

    try {
      const query = `SELECT * FROM "${fullTableName}" ORDER BY timestamp DESC LIMIT 100`;
      const result = await dbConnection.query(query);

      const transformedData = result.rows.map(row => {
        const timestamp = Number(row.timestamp);
        return [
          timestamp,
          0, // placeholder para open
          row.high,
          row.low,
          row.close,
          row.volume || "0",
          timestamp + 60000,
        ];
      }).sort((a, b) => a[0] - b[0]);

    // Ajustar el valor de 'open' de cada fila para que sea el 'close' de la fila anterior
    for (let i = 1; i < transformedData.length; i++) {
      transformedData[i][1] = transformedData[i - 1][4];
    }

      ws.send(JSON.stringify(transformedData));
    } catch (err) {
      console.error(err.stack);
      ws.send(JSON.stringify({ error: 'Error en la consulta a la base de datos' }));
    }
  });


  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});


server.listen(port, () => {
  console.log(`Servidor iniciado en el puerto ${port}`);
});
