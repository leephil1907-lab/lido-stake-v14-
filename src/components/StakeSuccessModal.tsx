import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Copy, Check, X, ArrowRight, ShieldCheck } from 'lucide-react';

interface StakeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string | null;
  amount: string;
}

export function StakeSuccessModal({
  isOpen,
  onClose,
  txHash,
  amount,
}: StakeSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !txHash) return null;

  const handleCopy = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  const etherscanUrl = `https://etherscan.io/tx/${txHash}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border-main rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#00A3FF]/20 rounded-full blur-[50px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#00D09E]/15 rounded-full blur-[50px] pointer-events-none" />

        {/* Modal Header */}
        <div className="p-5 border-b border-border-main flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-main tracking-tight">Transaction Confirmed</h3>
              <p className="text-[11px] text-text-secondary">Lido Liquid Staking Protocol</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-main hover:bg-input rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 relative z-10">
          {/* Main Success Graphic & Message */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#00D09E]/20 to-[#00A3FF]/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-xl font-extrabold text-text-main">
              Staking Successful!
            </h2>
            <p className="text-xs text-text-secondary max-w-xs mx-auto leading-relaxed">
              Your transaction has been confirmed on the Ethereum blockchain. You are now earning daily staking rewards.
            </p>
          </div>

          {/* Staked Overview Box */}
          <div className="bg-input rounded-2xl p-4 border border-border-main space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">Staked Amount</span>
              <span className="font-bold text-text-main font-mono">{amount || '0'} ETH</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">Received Token</span>
              <span className="font-bold text-[#00A3FF] font-mono">{amount || '0'} stETH</span>
            </div>
            <div className="pt-2 border-t border-border-main/60 flex items-center justify-between text-[11px] text-text-secondary">
              <span>Exchange Rate</span>
              <span className="font-medium text-text-main font-mono">1 ETH = 1 stETH</span>
            </div>
          </div>

          {/* Transaction Hash & Explorer Link */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
              Transaction Hash
            </label>
            <div className="flex items-center justify-between p-3 bg-input rounded-xl border border-border-main text-xs">
              <span className="font-mono text-text-main text-[11px] truncate mr-2" title={txHash}>
                {truncatedHash}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-main hover:bg-card border border-border-main/50 transition-colors flex items-center gap-1 text-[11px]"
                  title="Copy transaction hash"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <a
                  href={etherscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-[#00A3FF] hover:text-[#0090E6] hover:bg-card border border-border-main/50 transition-colors flex items-center gap-1 text-[11px] font-medium"
                >
                  <span>Etherscan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Trust Guarantee Note */}
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-[11px] text-emerald-400/90">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Your stETH balance will automatically update in your wallet and accrue rewards rebased daily.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-input/40 border-t border-border-main flex items-center gap-3 relative z-10">
          <a
            href={etherscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-1/2 py-3 px-4 bg-input hover:bg-card border border-border-main text-text-secondary hover:text-text-main font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View on Etherscan</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="w-1/2 py-3 px-4 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#00A3FF]/20 active:scale-[0.99]"
          >
            <span>Done</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
