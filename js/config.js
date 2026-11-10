/**
 * Public frontend configuration.
 * Replace CONTRACT_ADDRESS only with your real deployed MiniEscrow address.
 * Keep private keys and secrets out of frontend code: everything here is public.
 */
const APP_CONFIG = Object.freeze({
  CONTRACT_ADDRESS: "",
  CONTRACT_ABI: [], // TODO: Paste the ABI array produced by your Solidity compiler.
  FUJI: Object.freeze({
    chainId: 43113,
    chainIdHex: "0xa869",
    name: "Avalanche Fuji Testnet",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    explorerUrl: "https://testnet.snowtrace.io"
  })
});

