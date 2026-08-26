import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Layers,
  Search
} from 'lucide-react';
import { CONFIG, VAULT_ABI } from '../lib/contracts';
import { getActivities, ActivityRecord } from '../lib/activityLogger';
import { ConnectButton } from './ConnectButton';
import { Skeleton } from './LoadingSkeleton';
import { StEthIcon, EthIcon } from './TokenIcons';

export interface UserTransaction {
  id: string;
  txHash: string;
  type: 'STAKE' | 'WRAP' | 'UNWRAP' | 'WITHDRAW_REQUEST' | 'WITHDRAW_CLAIM';
  amount: string;
  token: string;
  timestamp: string;
  blockNumber?: bigint | number;
  status: 'Confirmed' | 'Pending' | 'Success';
  source: 'onchain' | 'local';
}

export function TransactionHistory() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [filter, setFilter] = useState<'ALL' | 'STAKE' | 'WRAP' | 'WITHDRAW'>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [onChainTxs, setOnChainTxs] = useState<UserTransaction[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setOnChainTxs([]);
      return;
    }

    setIsLoading(true);
    const results: UserTransaction[] = [];

    // 1. Fetch locally recorded user activity for instant responsiveness
    try {
      const localActivities = getActivities();
      const userLocal = localActivities.filter(
        (a) => a.wallet.toLowerCase() === address.toLowerCase()
      );

      for (const item of userLocal) {
        if (
          item.action === 'STAKE' ||
          item.action === 'WRAP' ||
          item.action === 'UNWRAP' ||
          item.action === 'WITHDRAW_REQUEST' ||
          item.action === 'WITHDRAW_CLAIM'
        ) {
          results.push({
            id: item.id,
            txHash: item.txHash || `0x${item.id.replace(/[^a-f0-9]/gi, '').padEnd(64, '0').slice(0, 64)}`,
            type: item.action,
            amount: item.amount ? item.amount.replace(/[^0-9.]/g, '') || '0' : '0',
            token: item.token || (item.action === 'STAKE' ? 'stETH' : item.action.includes('WRAP') ? 'wstETH' : 'ETH'),
            timestamp: item.timestamp,
            status: item.status === 'Pending' ? 'Pending' : 'Confirmed',
            source: 'local',
          });
        }
      }
    } catch (err) {
      console.warn('Error reading local activity logs:', err);
    }

    // 2. Query On-Chain Event Logs from RPC if publicClient is available
    if (publicClient) {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        // Safe lookback range to prevent RPC rate-limit block range errors
        const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : 0n;

        // Query Deposited events from MiddlemanVault
        try {
          const depositLogs = await publicClient.getLogs({
            address: CONFIG.CONTRACT_ADDRESS,
            event: parseAbiItem('event Deposited(address indexed user, uint256 amount)'),
            args: {
              user: address as `0x${string}`,
            },
            fromBlock,
            toBlock: latestBlock,
          });

          for (const log of depositLogs) {
            results.push({
              id: `onchain-dep-${log.transactionHash}-${log.logIndex}`,
              txHash: log.transactionHash,
              type: 'STAKE',
              amount: log.args.amount ? formatEther(log.args.amount) : '0',
              token: 'stETH',
              timestamp: new Date().toISOString(),
              blockNumber: log.blockNumber,
              status: 'Confirmed',
              source: 'onchain',
            });
          }
        } catch (e) {
          console.debug('Deposit log query skipped:', e);
        }

        // Query WithdrawETH events from MiddlemanVault
        try {
          const withdrawLogs = await publicClient.getLogs({
            address: CONFIG.CONTRACT_ADDRESS,
            event: parseAbiItem('event WithdrawETH(address indexed to, uint256 amount)'),
            args: {
              to: address as `0x${string}`,
            },
            fromBlock,
            toBlock: latestBlock,
          });

          for (const log of withdrawLogs) {
            results.push({
              id: `onchain-weth-${log.transactionHash}-${log.logIndex}`,
              txHash: log.transactionHash,
              type: 'WITHDRAW_CLAIM',
              amount: log.args.amount ? formatEther(log.args.amount) : '0',
              token: 'ETH',
              timestamp: new Date().toISOString(),
              blockNumber: log.blockNumber,
              status: 'Confirmed',
              source: 'onchain',
            });
          }
        } catch (e) {
          console.debug('Withdrawal log query skipped:', e);
        }

        // Query LidoStaked events
        try {
          const lidoLogs = await publicClient.getLogs({
            address: CONFIG.CONTRACT_ADDRESS,
            event: parseAbiItem('event LidoStaked(address indexed user, uint256 amount, uint256 minted)'),
            args: {
              user: address as `0x${string}`,
            },
            fromBlock,
            toBlock: latestBlock,
          });

          for (const log of lidoLogs) {
            results.push({
              id: `onchain-lido-${log.transactionHash}-${log.logIndex}`,
              txHash: log.transactionHash,
              type: 'STAKE',
              amount: log.args.minted ? formatEther(log.args.minted) : log.args.amount ? formatEther(log.args.amount) : '0',
              token: 'stETH',
              timestamp: new Date().toISOString(),
              blockNumber: log.blockNumber,
              status: 'Confirmed',
              source: 'onchain',
            });
          }
        } catch (e) {
          console.debug('Lido stake log query skipped:', e);
        }
      } catch (err) {
        console.warn('On-chain log query error:', err);
      }
    }

    // Deduplicate by txHash & merge
    const seenHashes = new Set<string>();
    const deduplicated: UserTransaction[] = [];

    for (const item of results) {
      const normalizedHash = item.txHash.toLowerCase();
      if (!seenHashes.has(normalizedHash)) {
        seenHashes.add(normalizedHash);
        deduplicated.push(item);
      }
    }

    // Sort by timestamp or block number descending
    deduplicated.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    setOnChainTxs(deduplicated);
    setIsLoading(false);
    setLastRefreshed(new Date());
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) {
      fetchHistory();
    } else {
      setOnChainTxs([]);
    }

    const handleUpdate = () => {
      if (isConnected && address) fetchHistory();
    };

    window.addEventListener('lido_activity_updated', handleUpdate);
    return () => window.removeEventListener('lido_activity_updated', handleUpdate);
  }, [isConnected, address, fetchHistory]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredTransactions = useMemo(() => {
    return onChainTxs.filter((tx) => {
      if (filter === 'ALL') return true;
      if (filter === 'STAKE') return tx.type === 'STAKE';
      if (filter === 'WRAP') return tx.type === 'WRAP' || tx.type === 'UNWRAP';
      if (filter === 'WITHDRAW') return tx.type === 'WITHDRAW_REQUEST' || tx.type === 'WITHDRAW_CLAIM';
      return true;
    });
  }, [onChainTxs, filter]);

  // Statistics calculation for user
  const stats = useMemo(() => {
    let totalStaked = 0;
    let totalWrapped = 0;
    let totalWithdrawn = 0;

    for (const tx of onChainTxs) {
      const val = parseFloat(tx.amount) || 0;
      if (tx.type === 'STAKE') totalStaked += val;
      else if (tx.type === 'WRAP') totalWrapped += val;
      else if (tx.type === 'WITHDRAW_REQUEST' || tx.type === 'WITHDRAW_CLAIM') totalWithdrawn += val;
    }

    return {
      totalStaked: totalStaked.toFixed(3),
      totalWrapped: totalWrapped.toFixed(3),
      totalWithdrawn: totalWithdrawn.toFixed(3),
      count: onChainTxs.length,
    };
  }, [onChainTxs]);

  const getActionBadge = (type: UserTransaction['type']) => {
    switch (type) {
      case 'STAKE':
        return {
          label: 'Stake ETH',
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />,
          bgColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        };
      case 'WRAP':
        return {
          label: 'Wrap stETH',
          icon: <Repeat className="w-3.5 h-3.5 text-[#00A3FF]" />,
          bgColor: 'bg-[#00A3FF]/10 text-[#00A3FF] border-[#00A3FF]/20',
        };
      case 'UNWRAP':
        return {
          label: 'Unwrap wstETH',
          icon: <Repeat className="w-3.5 h-3.5 text-purple-400" />,
          bgColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        };
      case 'WITHDRAW_REQUEST':
        return {
          label: 'Withdrawal Request',
          icon: <ArrowDownLeft className="w-3.5 h-3.5 text-amber-500" />,
          bgColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        };
      case 'WITHDRAW_CLAIM':
        return {
          label: 'Withdrawal Claim',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#00A3FF]" />,
          bgColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      default:
        return {
          label: 'Transaction',
          icon: <Layers className="w-3.5 h-3.5 text-text-secondary" />,
          bgColor: 'bg-input text-text-secondary border-border-main',
        };
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Recently';
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div id="transaction-history-section" className="bg-card rounded-[24px] p-4 sm:p-6 border border-border-main shadow-sm space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-main pb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#00A3FF]" />
            <h2 className="text-lg font-bold text-text-main">Transaction History</h2>
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#00A3FF]/10 text-[#00A3FF] rounded-full border border-[#00A3FF]/20">
              {isConnected ? `${onChainTxs.length} records` : '0'}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Querying blockchain event logs for wallet {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '(disconnected)'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={() => fetchHistory()}
              disabled={isLoading}
              className="p-2 rounded-xl border border-border-main bg-input hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary hover:text-text-main transition-colors text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh blockchain logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00A3FF]' : ''}`} />
              <span className="hidden xs:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Connected Summary Stats */}
      {isConnected && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-input/50 rounded-xl border border-border-main space-y-1">
            <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <span>Staked Total</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-text-main font-mono">
              {isLoading ? <Skeleton className="h-5 w-16" /> : `${stats.totalStaked} ETH`}
            </div>
          </div>

          <div className="p-3 bg-input/50 rounded-xl border border-border-main space-y-1">
            <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
              <Repeat className="w-3 h-3 text-[#00A3FF]" />
              <span>Wrapped</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-text-main font-mono">
              {isLoading ? <Skeleton className="h-5 w-16" /> : `${stats.totalWrapped} stETH`}
            </div>
          </div>

          <div className="p-3 bg-input/50 rounded-xl border border-border-main space-y-1">
            <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-amber-500" />
              <span>Withdrawn</span>
            </div>
            <div className="text-sm sm:text-base font-bold text-text-main font-mono">
              {isLoading ? <Skeleton className="h-5 w-16" /> : `${stats.totalWithdrawn} ETH`}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['ALL', 'STAKE', 'WRAP', 'WITHDRAW'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === tab
                ? 'bg-[#00A3FF] text-white shadow-sm'
                : 'bg-input text-text-secondary hover:text-text-main border border-border-main'
            }`}
          >
            {tab === 'ALL' ? 'All Interactions' : tab === 'STAKE' ? 'Stakes' : tab === 'WRAP' ? 'Wraps' : 'Withdrawals'}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {!isConnected ? (
        <div className="p-8 bg-input/40 border border-border-main rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#00A3FF]/10 flex items-center justify-center mx-auto text-[#00A3FF]">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-text-main">Connect Wallet to View History</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Connect your Web3 wallet to automatically fetch and display your past staking, wrapping, and withdrawal transaction logs from the Ethereum blockchain.
            </p>
          </div>
          <div className="pt-2">
            <ConnectButton className="mx-auto" />
          </div>
        </div>
      ) : isLoading && onChainTxs.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-input/40 border border-border-main rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="w-24 h-4" />
                  <Skeleton className="w-32 h-3" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <Skeleton className="w-16 h-4 ml-auto" />
                <Skeleton className="w-20 h-3 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-8 bg-input/30 border border-border-main rounded-2xl text-center space-y-2">
          <Clock className="w-8 h-8 text-text-secondary mx-auto opacity-40" />
          <h3 className="font-bold text-sm text-text-main">No Transactions Found</h3>
          <p className="text-xs text-text-secondary max-w-xs mx-auto">
            {filter === 'ALL'
              ? `No on-chain interactions detected for wallet ${address?.slice(0, 6)}...${address?.slice(-4)} yet.`
              : `No ${filter.toLowerCase()} interactions found under current filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredTransactions.map((tx) => {
            const badge = getActionBadge(tx.type);
            const isCopy = copiedHash === tx.txHash;

            return (
              <div
                key={tx.id}
                className="p-3.5 bg-input/40 hover:bg-input/70 border border-border-main rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
              >
                {/* Left info: Icon & Action */}
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${badge.bgColor}`}>
                    {badge.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-main">{badge.label}</span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-card border border-border-main text-text-secondary">
                        {tx.source === 'onchain' ? 'On-Chain' : 'App Relay'}
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary flex items-center gap-2 mt-0.5">
                      <span>{formatTime(tx.timestamp)}</span>
                      <span>•</span>
                      <button
                        onClick={() => copyToClipboard(tx.txHash)}
                        className="font-mono text-[10px] text-text-secondary hover:text-[#00A3FF] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy Tx Hash"
                      >
                        <span>{tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}</span>
                        {isCopy ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right info: Amount, Token & Explorer link */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right pl-11 sm:pl-0">
                  <div>
                    <div className="text-sm font-bold text-text-main font-mono flex items-center sm:justify-end gap-1.5">
                      {tx.type === 'WITHDRAW_REQUEST' || tx.type === 'UNWRAP' ? '-' : '+'}
                      {tx.amount} {tx.token}
                    </div>
                    <div className="text-[10px] text-emerald-500 font-semibold flex items-center sm:justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>{tx.status}</span>
                    </div>
                  </div>

                  <a
                    href={`https://etherscan.io/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg border border-border-main bg-card hover:bg-[#00A3FF]/10 hover:text-[#00A3FF] hover:border-[#00A3FF]/30 text-text-secondary transition-all shrink-0"
                    title="View on Etherscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Helper */}
      <div className="text-center pt-1 border-t border-border-main/50">
        <p className="text-[11px] text-text-secondary">
          Transactions are synced with Ethereum Mainnet contracts and update automatically upon block confirmation.
        </p>
      </div>
    </div>
  );
}
