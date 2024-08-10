const { Client } = require('pg');
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const ethers = require("ethers");
const { contractABI_UNISWAP_PAIR, contractABI_MEMEFACTORY, contractABI_POOL_FACTORY } = require('./abis/Constants.js');
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = process.env.PORT_SEPOLIA || 3004;


//CONSTANTS
const providerUrl = process.env.PROVIDER_URL_SEPOLIA;
const poolfactory = process.env.CONTRACT_POOL_FACTORY_SEPOLIA;
const contract_memefactory= process.env.CONTRACT_MEME_FACTORY_SEPOLIA;
const contract_WETH = process.env.CONTRACT_WETH_SEPOLIA;
const ethPriceInUSD = 2500;

/*
const dbConnection = new Client({
  user: process.env.USER_POSTGRES,
  host: process.env.HOST_DB_POSTGRES,
  database: process.env.DATABASE_DB_POSTGRES,
  password: process.env.PASSWORD_DB_POSTGRES,
  port: process.env.PORT_DB_POSTGRES,
});
*/

// Crea una instancia del cliente PostgreSQL con opciones de SSL/TLS
const dbConnection = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'DegenSQL',
  password: '1M3M323_3-152G0553XD##',
  port: 5432,
});


dbConnection.connect()
  .then(() => console.log('Conectado a la base de datos PostgreSQL'))
  .catch(err => console.error('Error al conectar a la base de datos PostgreSQL', err));

const etherconnect = async (contract_address, contractABI) => {
  const provider = new ethers.WebSocketProvider(providerUrl);
  const transactionsContract = new ethers.Contract(contract_address, contractABI, provider);
  return transactionsContract
}

const getReserves = async (pairpoolContract) => {
  const transactionsContract = etherconnect(pairpoolContract, contractABI_UNISWAP_PAIR);

  //obtenemos las reservas
  const [reserve0, reserve1, blockTimestampLast] = await transactionsContract.getReserves();
  console.log("reserve zero",reserve0);
  console.log("reserve one",reserve1);

  return [reserve0, reserve1]; // Devuelve un array con las reservas
}

const reservspooldatasave = async (pairpoolContract) => {
  try {
    const [reserve0, reserve1] = await getReserves(pairpoolContract);
    // Convertir valores a números (ajustar la precisión según sea necesario)
    const reserve0InTokens = parseFloat(ethers.formatUnits(reserve0, 18)); // Ajusta el número de decimales según el token
    const reserve1InTokens = parseFloat(ethers.formatUnits(reserve1, 18)); // Ajusta el número de decimales según el token

    // Calcular el valor de las reservas en USD

    const reserve0InUSD = reserve0InTokens * ethPriceInUSD;
    const tokenPriceInUSD = reserve0InUSD / reserve1InTokens;

    const nowTimestamp = Date.now(); // Obtiene el timestamp en milisegundos

    // Construir la consulta SQL dinámica
    const query = `
      INSERT INTO "${pairpoolContract.silce(1)}" (open, high, low, close, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `;

    // Ejecutar la consulta SQL
    await dbConnection.query(query, [tokenPriceInUSD, tokenPriceInUSD, tokenPriceInUSD, tokenPriceInUSD, nowTimestamp]);

  } catch (error) {
    console.error('Error en reservspooldata:', error);
  }
};

const listenSwapEvents = async (poolContract) => {

  const transactionsContract = await etherconnect(poolContract, contractABI_UNISWAP_PAIR);

  console.log(`Listener de swap para el pool ${poolContract} en línea`);

  transactionsContract.on("Swap", async (address, amount0In, amount1In, amount0Out, amount1Out, address2) => {
    console.log('Evento Swap detectado:', {
      address, amount0In, amount1In, amount0Out, amount1Out, address2
    });
    await reservspooldatasave(poolContract);
  });
}


const checkAddingLiquidity = async (sponsor, token_contract) => {

  const transactionsContract = await etherconnect(poolfactory, contractABI_POOL_FACTORY);

  const pre_pairAddress = await transactionsContract.getPair(token_contract, contract_WETH);

  const pairAddress = "TETH_"+pre_pairAddress.slice(1);

  try {
    // Verificar si el pool_pair ya existe en la tabla
    const checkQuery = `
      SELECT 1 FROM data_pools WHERE pool_pair = $1 LIMIT 1
    `;

    const checkResult = await dbConnection.query(checkQuery, [pairAddress]);

    if (checkResult.rows.length === 0) {
      // Si no existe, insertar la nueva fila
      const insertQuery = `
        INSERT INTO data_pools (sponsor, token_contract, pool_pair)
        VALUES ($1, $2, $3)
      `;

      await dbConnection.query(insertQuery, [sponsor, token_contract, pairAddress]);
      console.log("Fila añadida");

      // Crear una nueva tabla con el nombre del token_contract
      const createTableQuery = `
        CREATE TABLE TETH_${pairAddress} (
          open DOUBLE PRECISION,
          high DOUBLE PRECISION,
          low DOUBLE PRECISION,
          close DOUBLE PRECISION,
          timestamp VARCHAR PRIMARY KEY
        )
      `;

      await dbConnection.query(createTableQuery);
      console.log(`Tabla ${pairAddress} creada`);

      //escuchar eventos del swap

      listenSwapEvents(pairAddress, poolfactory);

    } else {
      console.log("El token_contract ya existe, no se añadió una nueva fila ni se creó una nueva tabla");
    }
  } catch (error) {
    console.error("Error al ejecutar la consulta:", error);
  }
};

const listenMemefactory = async (contract_memefactory, contractABI) => {
  const transactionsContract_2 = await etherconnect(contract_memefactory, contractABI);
  console.log("memefactory listener online")

  transactionsContract_2.on("LiquidityAdded", async (sponsor, address_token, value) => {
  console.log("we have here listen created pool", sponsor, "address contract",address_token, "value eth", value);
  await checkAddingLiquidity(sponsor, address_token);

  });
}

listenMemefactory(contract_memefactory, contractABI_MEMEFACTORY);


server.listen(port, () => {
  console.log(`Servidor iniciado en el puerto ${port}`);
});