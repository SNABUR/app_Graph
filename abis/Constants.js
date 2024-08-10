const UniswapV2Pair = require('./UniswapV2Pair.json');
const MemeFactory = require('./MemeFactory.json');
const PoolFactory = require('./UniswapV2Factory.json');

const contractABI_UNISWAP_PAIR = UniswapV2Pair.abi;
const contractABI_MEMEFACTORY = MemeFactory.abi;
const contractABI_POOL_FACTORY = PoolFactory.abi;

module.exports = {
    contractABI_UNISWAP_PAIR: contractABI_UNISWAP_PAIR,
    contractABI_MEMEFACTORY: contractABI_MEMEFACTORY,
    contractABI_POOL_FACTORY: contractABI_POOL_FACTORY
};
