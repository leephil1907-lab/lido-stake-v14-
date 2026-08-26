import { fallback, http } from 'viem'
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks'

/**
 * Alchemy API Key configuration.
 * Uses environment variable if provided, or defaults to public template key.
 */
export const ALCHEMY_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALCHEMY_API_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_ALCHEMY_API_KEY || process.env?.ALCHEMY_API_KEY)) ||
  'XbS3A-psx-MSEn_ownjsb0You7sONhdF'

/**
 * Alchemy RPC URLs mapping by chain ID.
 */
export const ALCHEMY_RPC_URLS: Record<number, string> = {
  [sepolia.id]: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  [arbitrum.id]: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
}

/**
 * Primary and Fallback RPC endpoints mapping by chain ID for redundant Web3 connections.
 */
export const FALLBACK_RPC_URLS: Record<number, string[]> = {
  [sepolia.id]: [
    `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.gateway.tenderly.co',
    'https://rpc2.sepolia.org',
  ],
  [mainnet.id]: [
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    'https://cloudflare-eth.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum-rpc.publicnode.com',
  ],
  [arbitrum.id]: [
    `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum-one-rpc.publicnode.com',
  ],
}

/**
 * Returns primary RPC URL for a given chain ID
 */
export function getRpcUrl(chainId: number = sepolia.id): string {
  return ALCHEMY_RPC_URLS[chainId] || FALLBACK_RPC_URLS[chainId]?.[0] || 'https://rpc.sepolia.org'
}

/**
 * Returns Alchemy RPC URL for a specific network name
 */
export function getAlchemyRpcUrl(network: string = 'eth-sepolia'): string {
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
}

/**
 * Viem Fallback HTTP Transports for Wagmi configuration,
 * ensuring automatic failover to redundant public providers if primary Alchemy connection fails.
 */
export const rpcTransports = {
  [sepolia.id]: fallback(
    FALLBACK_RPC_URLS[sepolia.id].map((url) => http(url, { timeout: 10_000, retryCount: 2 }))
  ),
  [mainnet.id]: fallback(
    FALLBACK_RPC_URLS[mainnet.id].map((url) => http(url, { timeout: 10_000, retryCount: 2 }))
  ),
  [arbitrum.id]: fallback(
    FALLBACK_RPC_URLS[arbitrum.id].map((url) => http(url, { timeout: 10_000, retryCount: 2 }))
  ),
}

